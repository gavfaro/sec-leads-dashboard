// Ported from math_engine/investor_encoder.py -- keep in sync by hand if that
// file's stage logic changes (see lib/matching/types.ts for why this fork exists).

export const STAGE_VOCABULARY = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth"];

const STAGE_ALIASES: Record<string, string> = {
  "pre-seed": "Pre-Seed", "preseed": "Pre-Seed", "pre seed": "Pre-Seed",
  "seed": "Seed", "pre-seed/seed": "Seed",
  "series a": "Series A", "series-a": "Series A", "a": "Series A",
  // Sequoia's public taxonomy just says "Early" for its venture-stage bucket
  // (distinct from its own separate "Pre-Seed/Seed" label) -- Series A is the
  // closest single vocabulary entry.
  "early": "Series A",
  "series b": "Series B", "series-b": "Series B", "b": "Series B",
  "series c": "Series C+", "series-c": "Series C+", "c": "Series C+",
  "series d": "Series C+", "series e": "Series C+", "series d+": "Series C+",
  "growth": "Growth", "growth equity": "Growth", "late stage": "Growth",
  "late-stage": "Growth",
};

const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  STAGE_VOCABULARY.map((stage, i) => [stage, i]),
);

// An investment this many years old counts for half as much toward an investor's
// stage focus -- lets a fund's *current* behavior dominate its historical portfolio.
const RECENCY_HALF_LIFE_YEARS = 5.0;

export function recencyWeight(year: number | null | undefined): number {
  if (year == null) return 1.0;
  const yearsAgo = Math.max(0, new Date().getFullYear() - year);
  return Math.pow(0.5, yearsAgo / RECENCY_HALF_LIFE_YEARS);
}

export function normalizeStage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return STAGE_ALIASES[key] ?? null;
}

export function stageCloseness(stageA: string | null, stageB: string | null): number {
  if (stageA == null || stageB == null) return 0.5;
  if (stageA === stageB) return 1.0;
  const distance = Math.abs(STAGE_ORDER[stageA] - STAGE_ORDER[stageB]);
  return Math.max(0.0, 1.0 - 0.34 * distance);
}

export function distributionStageFit(
  distribution: Record<string, number>,
  targetStage: string | null,
): number {
  const entries = Object.entries(distribution);
  if (entries.length === 0 || targetStage == null) return 0.5;
  return entries.reduce((sum, [stage, weight]) => sum + weight * stageCloseness(stage, targetStage), 0);
}
