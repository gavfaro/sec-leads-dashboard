// Ported from math_engine/matcher.py.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContactFeatureEncoder } from "./encoder";
import { fetchInvestorData } from "./dataPuller";
import { distributionStageFit, normalizeStage } from "./stage";
import type { Contact, ScoreBreakdown, ScoredResult, StartupInput } from "./types";

// Weighted-sum fusion, not a learned attention mechanism -- there's no labeled
// outcome data yet to fit weights against. Whatever's used gets stored on the run
// (weights_used) so past runs stay interpretable after the defaults change.
export const DEFAULT_WEIGHTS: Record<string, number> = {
  vertical: 0.30,
  stage: 0.25,
  check_size: 0.20,
  text: 0.25,
};

// Used whenever one side of a comparison has no data -- don't penalize a contact
// for missing enrichment, and don't reward it either.
const NEUTRAL_SCORE = 0.5;

function verticalOverlap(startupVerticals: string[], contactWeights: Record<string, number>): number {
  if (startupVerticals.length === 0 || Object.keys(contactWeights).length === 0) return NEUTRAL_SCORE;
  return startupVerticals.reduce((sum, v) => sum + (contactWeights[v] ?? 0), 0);
}

function checkSizeFit(typicalCheckSize: number | null, targetRaise: number | null): number {
  if (!typicalCheckSize || !targetRaise) return NEUTRAL_SCORE;
  const ratio = Math.max(typicalCheckSize, targetRaise) / Math.min(typicalCheckSize, targetRaise);
  return Math.max(0.0, 1.0 - Math.log10(ratio));
}

export type WeightOverrides = Partial<Record<keyof typeof DEFAULT_WEIGHTS, number | null | undefined>>;

// Merges any provided overrides onto DEFAULT_WEIGHTS and renormalizes so the final
// score stays on a comparable 0-1 scale regardless of which weights were tweaked.
export function resolveWeights(overrides?: WeightOverrides): Record<string, number> {
  const weights = { ...DEFAULT_WEIGHTS };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value != null) weights[key] = value;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return DEFAULT_WEIGHTS;
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / total]));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function scoreStartupAgainstInvestors(
  startup: StartupInput,
  contacts: Contact[],
  weights: Record<string, number>,
): ScoredResult[] {
  const encoder = new ContactFeatureEncoder(contacts);
  const normalizedStage = normalizeStage(startup.stage);

  const results: ScoredResult[] = contacts.map((contact, i) => {
    const verticalScore = verticalOverlap(startup.verticals, encoder.verticalWeights(contact));
    const stageScore = distributionStageFit(encoder.stageDistribution(contact), normalizedStage);
    const checkSizeScore = checkSizeFit(encoder.typicalCheckSize(contact), startup.targetRaise);
    const textScore = encoder.textSimilarity(i, startup.description);

    const breakdown: ScoreBreakdown = {
      vertical: round4(verticalScore),
      stage: round4(stageScore),
      check_size: round4(checkSizeScore),
      text: round4(textScore),
    };
    const score = round4(
      weights.vertical * breakdown.vertical +
        weights.stage * breakdown.stage +
        weights.check_size * breakdown.check_size +
        weights.text * breakdown.text,
    );

    return {
      contactId: contact.id,
      contactName: contact.name,
      orgName: contact.org_name,
      score,
      scoreBreakdown: breakdown,
      rank: 0,
    };
  });

  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => {
    r.rank = i + 1;
  });
  return results;
}

// Scores `startup` against every individual investor (contact), persists a
// match_runs row plus one match_results row per contact, and returns
// { matchRunId, results }.
export async function runMatch(
  sb: SupabaseClient,
  startup: StartupInput,
  weightOverrides?: WeightOverrides,
): Promise<{ matchRunId: string; results: ScoredResult[] }> {
  const weights = resolveWeights(weightOverrides);
  const contacts = await fetchInvestorData(sb);
  const results = scoreStartupAgainstInvestors(startup, contacts, weights);

  const { data: runData, error: runError } = await sb
    .from("match_runs")
    .insert({
      startup_name: startup.name,
      startup_input: {
        name: startup.name,
        verticals: startup.verticals,
        stage: startup.stage,
        target_raise: startup.targetRaise,
        description: startup.description,
        location: startup.location,
      },
      weights_used: weights,
    })
    .select("id")
    .single();

  if (runError || !runData) {
    throw new Error(runError?.message ?? "Failed to create match run");
  }
  const matchRunId = runData.id as string;

  if (results.length > 0) {
    const { error: resultsError } = await sb.from("match_results").insert(
      results.map((r) => ({
        match_run_id: matchRunId,
        contact_id: r.contactId,
        score: r.score,
        score_breakdown: r.scoreBreakdown,
        rank: r.rank,
      })),
    );
    if (resultsError) throw new Error(resultsError.message);
  }

  return { matchRunId, results };
}
