import argparse
import math
from dataclasses import asdict

from data_puller import fetch_investor_data, get_supabase
from investor_encoder import ContactFeatureEncoder, distribution_stage_fit
from startup_encoder import StartupInput

# Weighted-sum fusion, not a learned attention mechanism (see plan doc) -- there's no
# labeled outcome data yet to fit weights against. Tune these once enough completed
# matches accumulate to judge what actually predicts a good fit.
WEIGHTS = {
    "vertical": 0.30,
    "stage": 0.25,
    "check_size": 0.20,
    "text": 0.25,
}

NEUTRAL_SCORE = 0.5  # used whenever one side of a comparison has no data -- don't
                     # penalize a contact for missing enrichment, and don't reward it either.


def _vertical_overlap(startup_verticals: list[str], contact_weights: dict[str, float]) -> float:
    if not startup_verticals or not contact_weights:
        return NEUTRAL_SCORE
    return sum(contact_weights.get(v, 0.0) for v in startup_verticals)


def _check_size_fit(typical_check_size: float | None, target_raise: float | None) -> float:
    if not typical_check_size or not target_raise:
        return NEUTRAL_SCORE
    ratio = max(typical_check_size, target_raise) / min(typical_check_size, target_raise)
    return max(0.0, 1.0 - math.log10(ratio))


def score_startup_against_investors(startup: StartupInput, contacts: list[dict]) -> list[dict]:
    encoder = ContactFeatureEncoder(contacts)
    results = []

    for i, contact in enumerate(contacts):
        vertical_score = _vertical_overlap(startup.verticals, encoder.vertical_weights(contact))
        stage_score = distribution_stage_fit(encoder.stage_distribution(contact), startup.normalized_stage)
        check_size_score = _check_size_fit(encoder.typical_check_size(contact), startup.target_raise)
        text_score = encoder.text_similarity(i, startup.description)

        breakdown = {
            "vertical": round(vertical_score, 4),
            "stage": round(stage_score, 4),
            "check_size": round(check_size_score, 4),
            "text": round(text_score, 4),
        }
        score = sum(WEIGHTS[k] * v for k, v in breakdown.items())

        results.append({
            "contact_id": contact["id"],
            "contact_name": contact["name"],
            "org_name": contact["org_name"],
            "score": round(score, 4),
            "score_breakdown": breakdown,
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    for rank, r in enumerate(results, start=1):
        r["rank"] = rank
    return results


def run_match(startup: StartupInput) -> str:
    """Scores `startup` against every individual investor (contact), persists a
    match_runs row plus one match_results row per contact, and returns the new
    match_runs id."""
    supabase = get_supabase()
    contacts = fetch_investor_data()
    results = score_startup_against_investors(startup, contacts)

    run_res = (
        supabase.table("match_runs")
        .insert({"startup_name": startup.name, "startup_input": asdict(startup)})
        .execute()
    )
    match_run_id = run_res.data[0]["id"]

    if results:
        supabase.table("match_results").insert([
            {
                "match_run_id": match_run_id,
                "contact_id": r["contact_id"],
                "score": r["score"],
                "score_breakdown": r["score_breakdown"],
                "rank": r["rank"],
            }
            for r in results
        ]).execute()

    return match_run_id


def _parse_args() -> StartupInput:
    parser = argparse.ArgumentParser(description="Match a startup against the investor database.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--verticals", default="", help="Comma-separated, e.g. 'AI,Fintech & Crypto'")
    parser.add_argument("--stage", default=None, help="e.g. Seed, Series A")
    parser.add_argument("--target-raise", type=float, default=None)
    parser.add_argument("--description", default="")
    parser.add_argument("--location", default=None)
    args = parser.parse_args()

    return StartupInput(
        name=args.name,
        verticals=[v.strip() for v in args.verticals.split(",") if v.strip()],
        stage=args.stage,
        target_raise=args.target_raise,
        description=args.description,
        location=args.location,
    )


if __name__ == "__main__":
    startup = _parse_args()
    match_run_id = run_match(startup)
    print(f"match_run_id: {match_run_id}")
