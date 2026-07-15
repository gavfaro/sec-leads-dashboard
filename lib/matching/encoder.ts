// Ported from math_engine/investor_encoder.py's ContactFeatureEncoder.
import { TfidfIndex } from "./tfidf";
import { normalizeStage, recencyWeight } from "./stage";
import { textVerticalWeights } from "./vertical";
import type { Contact } from "./types";

// Rough industry-standard check sizes per stage, used only as a last-resort proxy
// when neither a contact's own manually-entered typical_check_size nor their firm's
// vertical_focus has real data. Broad market medians, not sourced from our own
// data -- meant to be superseded by real numbers whenever those exist.
const STAGE_CHECK_SIZE_PROXY: Record<string, number> = {
  "Pre-Seed": 300_000,
  "Seed": 1_500_000,
  "Series A": 8_000_000,
  "Series B": 20_000_000,
  "Series C+": 40_000_000,
  "Growth": 75_000_000,
};

function sumValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

function normalize(counts: Record<string, number>): Record<string, number> {
  const total = sumValues(counts);
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total]));
}

// Bio plus personal deal descriptions -- current investments count double, since a
// partner's active book of business says more about what they're doing now than
// deals from before an exit or role change.
function personalText(contact: Contact): string {
  const parts: string[] = [contact.bio ?? ""];
  for (const inv of contact.investments) {
    const desc = inv.description ?? "";
    if (!desc) continue;
    parts.push(desc);
    if (inv.relationship === "current") parts.push(desc);
  }
  return parts.filter(Boolean).join(" ");
}

export class ContactFeatureEncoder {
  private tfidf: TfidfIndex;

  constructor(private contacts: Contact[]) {
    this.tfidf = new TfidfIndex(contacts.map(personalText));
  }

  // Vertical name -> weight, normalized to sum to 1. Prefers the contact's own
  // contact_verticals tags; falls back to their firm's vertical_focus, then to
  // keyword inference from bio + portfolio text when neither structured source
  // has any tags.
  verticalWeights(contact: Contact): Record<string, number> {
    if (contact.contact_verticals.length > 0) {
      const counts: Record<string, number> = {};
      for (const v of contact.contact_verticals) counts[v] = (counts[v] ?? 0) + 1;
      return normalize(counts);
    }

    const orgCounts: Record<string, number> = {};
    for (const vf of contact.org_vertical_focus) {
      const vertical = vf.verticals?.vertical_name;
      if (vertical) orgCounts[vertical] = (orgCounts[vertical] ?? 0) + 1;
    }
    if (sumValues(orgCounts) > 0) return normalize(orgCounts);

    return textVerticalWeights(personalText(contact));
  }

  // Normalized distribution over STAGE_VOCABULARY, built from the contact's own
  // personal deals (investment_stage borrowed from the firm's portfolio_investments
  // for the same company, recency-weighted by year_partnered). Falls back to the
  // firm's vertical_focus.preferred_stage only if the contact has no
  // personally-attributable stage data at all.
  stageDistribution(contact: Contact): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const inv of contact.investments) {
      const stage = normalizeStage(inv.investment_stage);
      if (stage) counts[stage] = (counts[stage] ?? 0) + recencyWeight(inv.year_partnered);
    }
    if (sumValues(counts) > 0) return normalize(counts);

    const orgCounts: Record<string, number> = {};
    for (const vf of contact.org_vertical_focus) {
      const stage = normalizeStage(vf.preferred_stage);
      if (stage) orgCounts[stage] = (orgCounts[stage] ?? 0) + 1;
    }
    return normalize(orgCounts);
  }

  // Priority: the contact's own manually-researched check size (e.g. entered after
  // looking them up on Crunchbase) -> their firm's vertical_focus average -> a
  // stage-based industry proxy derived from the contact's own stage distribution,
  // since most firms don't publish real check-size data at all.
  typicalCheckSize(contact: Contact): number | null {
    if (contact.typical_check_size) return contact.typical_check_size;

    const sizes = contact.org_vertical_focus
      .map((vf) => vf.typical_check_size)
      .filter((v): v is number => v != null && v > 0);
    if (sizes.length > 0) return sizes.reduce((a, b) => a + b, 0) / sizes.length;

    const distribution = this.stageDistribution(contact);
    const entries = Object.entries(distribution);
    if (entries.length === 0) return null;
    return entries.reduce((sum, [stage, weight]) => sum + weight * (STAGE_CHECK_SIZE_PROXY[stage] ?? 0), 0);
  }

  // Cosine similarity between a startup's description and this contact's personal
  // bio + deal-description corpus. 0 if either side has no usable text.
  textSimilarity(contactIndex: number, startupDescription: string): number {
    if (!this.tfidf.hasVocabulary() || !startupDescription.trim()) return 0;
    const startupVec = this.tfidf.transformOne(startupDescription);
    const contactVec = this.tfidf.getDocVector(contactIndex);
    return TfidfIndex.cosineSimilarity(startupVec, contactVec);
  }
}
