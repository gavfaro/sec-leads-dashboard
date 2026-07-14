import re
from collections import defaultdict
from datetime import date

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

"""
We want to represent each individual investor (a contact -- the actual person to
recommend, not the firm) as a set of comparable features so we can score them against
a single ad hoc startup input (see startup_encoder.py). There isn't nearly enough data
yet to fit or train anything, so this builds features directly off whatever's been
scraped rather than learning a representation. v_i = (vertical_weights,
stage_distribution, typical_check_size, personal_text) for each contact i -- vertical
weights and check size fall back to the contact's firm when the contact has no
personal data of their own (contact_verticals is currently unpopulated everywhere).
"""

STAGE_VOCABULARY = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth"]

_STAGE_ALIASES = {
    "pre-seed": "Pre-Seed", "preseed": "Pre-Seed", "pre seed": "Pre-Seed",
    "seed": "Seed", "pre-seed/seed": "Seed",
    "series a": "Series A", "series-a": "Series A", "a": "Series A",
    # Sequoia's public taxonomy just says "Early" for its venture-stage bucket
    # (distinct from its own separate "Pre-Seed/Seed" label) -- Series A is the
    # closest single vocabulary entry.
    "early": "Series A",
    "series b": "Series B", "series-b": "Series B", "b": "Series B",
    "series c": "Series C+", "series-c": "Series C+", "c": "Series C+",
    "series d": "Series C+", "series e": "Series C+", "series d+": "Series C+",
    "growth": "Growth", "growth equity": "Growth", "late stage": "Growth",
    "late-stage": "Growth",
    # Exit/status values that end up in the same freeform column -- not a stage,
    # deliberately unmapped so normalize_stage() returns None and they're excluded
    # from stage_distribution rather than miscounted as a stage.
    # "ipo": None, "acquired": None,
}

# Used for partial credit when stages don't match exactly but are adjacent.
_STAGE_ORDER = {stage: i for i, stage in enumerate(STAGE_VOCABULARY)}

# An investment this many years old counts for half as much toward an investor's
# stage focus -- lets a fund's *current* behavior dominate its historical portfolio.
_RECENCY_HALF_LIFE_YEARS = 5.0


def recency_weight(year: int | None) -> float:
    """Exponential decay by year_partnered, so a fund that used to do seed but
    now only writes growth checks reads as growth-focused rather than a 50/50 blend
    of its whole history. Unknown years (rows the scraper hasn't backfilled
    year_partnered for) get full weight -- consistent with how missing data is
    treated everywhere else here: not penalized, not rewarded."""
    if year is None:
        return 1.0
    years_ago = max(0, date.today().year - year)
    return 0.5 ** (years_ago / _RECENCY_HALF_LIFE_YEARS)


def normalize_stage(raw: str | None) -> str | None:
    """Maps freeform investment_stage/preferred_stage text onto STAGE_VOCABULARY.
    Returns None (not a stage in the vocabulary) rather than guessing."""
    if not raw:
        return None
    key = re.sub(r"\s+", " ", raw.strip().lower())
    return _STAGE_ALIASES.get(key)


def stage_closeness(stage_a: str | None, stage_b: str | None) -> float:
    """1.0 for an exact stage match, partial credit for adjacent stages, 0 otherwise.
    Returns a neutral 0.5 if either side is unknown, since we shouldn't penalize an
    investor for missing stage data we never collected."""
    if stage_a is None or stage_b is None:
        return 0.5
    if stage_a == stage_b:
        return 1.0
    distance = abs(_STAGE_ORDER[stage_a] - _STAGE_ORDER[stage_b])
    return max(0.0, 1.0 - 0.34 * distance)


class ContactFeatureEncoder:
    def __init__(self, contacts: list[dict]):
        self.contacts = contacts
        self._docs = [self._personal_text(c) for c in contacts]
        self._tfidf = TfidfVectorizer(stop_words="english", max_features=2000)
        # Guard against an all-empty corpus (no bios/descriptions yet) --
        # TfidfVectorizer.fit raises on an empty vocabulary.
        if any(doc.strip() for doc in self._docs):
            self._tfidf_matrix = self._tfidf.fit_transform(self._docs)
        else:
            self._tfidf_matrix = None

    @staticmethod
    def _personal_text(contact: dict) -> str:
        """Bio plus personal deal descriptions -- current investments count double,
        since a partner's active book of business says more about what they're doing
        now than deals from before an exit or role change."""
        parts = [contact.get("bio") or ""]
        for inv in contact.get("investments") or []:
            desc = inv.get("description") or ""
            if not desc:
                continue
            parts.append(desc)
            if inv.get("relationship") == "current":
                parts.append(desc)
        return " ".join(p for p in parts if p)

    @staticmethod
    def vertical_weights(contact: dict) -> dict[str, float]:
        """Vertical name -> weight, normalized to sum to 1. Prefers the contact's own
        contact_verticals tags; falls back to their firm's vertical_focus when the
        contact has none of their own (currently always, since contact_verticals is
        unpopulated everywhere)."""
        own = contact.get("contact_verticals") or []
        if own:
            counts: dict[str, float] = defaultdict(float)
            for vertical in own:
                counts[vertical] += 1.0
            total = sum(counts.values())
            return {k: v / total for k, v in counts.items()}

        counts = defaultdict(float)
        for vf in contact.get("org_vertical_focus") or []:
            vertical = (vf.get("verticals") or {}).get("vertical_name")
            if vertical:
                counts[vertical] += 1.0
        total = sum(counts.values())
        return {k: v / total for k, v in counts.items()} if total else {}

    @staticmethod
    def stage_distribution(contact: dict) -> dict[str, float]:
        """Normalized distribution over STAGE_VOCABULARY, built from the contact's
        own personal deals (investment_stage borrowed from the firm's
        portfolio_investments for the same company, recency-weighted by
        year_partnered). Falls back to the firm's vertical_focus.preferred_stage only
        if the contact has no personally-attributable stage data at all."""
        counts: dict[str, float] = defaultdict(float)
        for inv in contact.get("investments") or []:
            stage = normalize_stage(inv.get("investment_stage"))
            if stage:
                counts[stage] += recency_weight(inv.get("year_partnered"))
        if counts:
            total = sum(counts.values())
            return {k: v / total for k, v in counts.items()}

        for vf in contact.get("org_vertical_focus") or []:
            stage = normalize_stage(vf.get("preferred_stage"))
            if stage:
                counts[stage] += 1.0
        total = sum(counts.values())
        return {k: v / total for k, v in counts.items()} if total else {}

    @staticmethod
    def dominant_stage(contact: dict) -> str | None:
        dist = ContactFeatureEncoder.stage_distribution(contact)
        return max(dist, key=dist.get) if dist else None

    @staticmethod
    def typical_check_size(contact: dict) -> float | None:
        """Individuals don't have their own check-size data -- always inherited
        from the firm."""
        sizes = [
            vf["typical_check_size"]
            for vf in (contact.get("org_vertical_focus") or [])
            if vf.get("typical_check_size")
        ]
        return sum(sizes) / len(sizes) if sizes else None

    def text_similarity(self, contact_index: int, startup_description: str) -> float:
        """Cosine similarity between a startup's description and this contact's
        personal bio + deal-description corpus. 0 if either side has no usable text."""
        if self._tfidf_matrix is None or not startup_description.strip():
            return 0.0
        startup_vec = self._tfidf.transform([startup_description])
        contact_vec = self._tfidf_matrix[contact_index]
        denom = np.sqrt(startup_vec.multiply(startup_vec).sum()) * np.sqrt(contact_vec.multiply(contact_vec).sum())
        if not denom:
            return 0.0
        return float(startup_vec.multiply(contact_vec).sum() / denom)
