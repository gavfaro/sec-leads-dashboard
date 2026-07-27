// Ported from math_engine/matcher.py.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ContactFeatureEncoder, personalText } from "./encoder";
import { fetchInvestorData } from "./dataPuller";
import { distributionStageFit, normalizeStage } from "./stage";
import { cosineSimilarity, embedText } from "./embeddings";
import {
  fetchAllVerticalTagEmbeddings,
  getOrCreateEmbeddings,
  nearestVerticalTags,
  normalizeTag,
} from "./verticalEmbeddings";
import {
  BIO_SIMILARITY_THRESHOLD,
  DEFAULT_SIMILARITY_THRESHOLD,
  fetchAllCompanyEmbeddings,
  fetchAllContactBioEmbeddings,
  portfolioRelevanceScore,
  relevantPortfolioCompanies,
} from "./companySimilarity";
import type {
  Contact,
  ScoreBreakdown,
  ScoredResult,
  SimilarCompanyBreakdown,
  StartupInput,
} from "./types";

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

// How many live embedText() calls run concurrently when resolving the tier-3
// fallback below -- mirrors verticalEmbeddings.ts's EMBED_CONCURRENCY so a
// match run with an unusually large batch of under-enriched contacts can't
// burst past the hosted embeddings API's per-minute rate limit.
const FALLBACK_EMBED_CONCURRENCY = 10;

// Last-resort vertical inference for contacts with neither their own
// contact_verticals nor their firm's vertical_focus: embeds their bio +
// portfolio text and takes the nearest cached vertical tags, the same
// nearest-neighbor approach already used for the company-verticals popup
// (verticalEmbeddings.ts) -- replacing what used to be a fixed 12-category
// keyword table that predated the embedding infrastructure and covered a
// fraction of the now ~270-tag vocabulary.
async function inferVerticalWeightsForContacts(
  contacts: Contact[],
  indices: number[],
  tagEmbeddings: Map<string, number[]>,
): Promise<Map<number, Record<string, number>>> {
  const result = new Map<number, Record<string, number>>();
  for (let i = 0; i < indices.length; i += FALLBACK_EMBED_CONCURRENCY) {
    const batch = indices.slice(i, i + FALLBACK_EMBED_CONCURRENCY);
    const resolved = await Promise.all(
      batch.map(async (contactIndex) => {
        const text = personalText(contacts[contactIndex]);
        if (!text.trim()) return {};
        const embedding = await embedText(text);
        const nearest = nearestVerticalTags(embedding, tagEmbeddings, 3);
        const weights: Record<string, number> = {};
        for (const n of nearest) weights[n.tag] = n.score;
        return weights;
      }),
    );
    batch.forEach((contactIndex, j) => result.set(contactIndex, resolved[j]));
  }
  return result;
}

// Vertical fit is embedding-based rather than exact-string matching: the tag
// vocabulary scraped across firms has grown into the hundreds of fragmented
// spellings of the same concepts (Y Combinator alone has 280+ distinct tags --
// "AIOps", "Generative AI", "Machine Learning", "ML" all mean roughly the same
// thing), so a hand-maintained alias table stopped being viable. This reuses
// ContactFeatureEncoder.structuredVerticalWeights()'s fallback chain (a contact's
// own tags -> their firm's -> embedding-inferred from bio/portfolio text) --
// it just swaps the final "does this tag exactly match a startup tag" comparison
// for semantic similarity, weighted by how much each tag represents the contact.
async function computeVerticalFits(
  sb: SupabaseClient,
  startupVerticals: string[],
  contacts: Contact[],
): Promise<Map<string, number>> {
  const fits = new Map<string, number>();
  if (startupVerticals.length === 0) {
    for (const c of contacts) fits.set(c.id, NEUTRAL_SCORE);
    return fits;
  }

  const structured = contacts.map((c) => ContactFeatureEncoder.structuredVerticalWeights(c));
  const contactWeightMaps: Record<string, number>[] = structured.map((m) => m ?? {});

  const needsFallback = contacts
    .map((_, i) => i)
    .filter((i) => structured[i] === null);
  if (needsFallback.length > 0) {
    try {
      const tagEmbeddings = await fetchAllVerticalTagEmbeddings(sb);
      const inferred = await inferVerticalWeightsForContacts(contacts, needsFallback, tagEmbeddings);
      for (const [contactIndex, weights] of inferred) {
        contactWeightMaps[contactIndex] = weights;
      }
    } catch (err) {
      // No structured tags and the fallback itself failed -- leave these
      // contacts with an empty weight map, same as "no personal text to infer
      // from" below, which resolves to NEUTRAL_SCORE.
      console.error("Embedding-based vertical fallback failed:", err);
    }
  }

  const allTags = [...startupVerticals, ...contactWeightMaps.flatMap((m) => Object.keys(m))];

  let embeddings: Map<string, number[]>;
  try {
    embeddings = await getOrCreateEmbeddings(sb, allTags);
  } catch (err) {
    // Degrade to neutral rather than failing the whole match if the embeddings
    // API is unreachable or misconfigured -- vertical is one signal of four.
    console.error("Vertical embedding lookup failed, falling back to neutral:", err);
    for (const c of contacts) fits.set(c.id, NEUTRAL_SCORE);
    return fits;
  }

  const startupVectors = startupVerticals
    .map((t) => embeddings.get(normalizeTag(t)))
    .filter((v): v is number[] => Boolean(v));

  contacts.forEach((contact, i) => {
    const tagWeights = Object.entries(contactWeightMaps[i]);
    if (startupVectors.length === 0 || tagWeights.length === 0) {
      fits.set(contact.id, NEUTRAL_SCORE);
      return;
    }

    let weightedSum = 0;
    let weightTotal = 0;
    for (const [tag, weight] of tagWeights) {
      const tagVec = embeddings.get(normalizeTag(tag));
      if (!tagVec) continue;
      const bestMatch = Math.max(...startupVectors.map((sv) => cosineSimilarity(sv, tagVec)));
      weightedSum += weight * bestMatch;
      weightTotal += weight;
    }
    fits.set(contact.id, weightTotal > 0 ? weightedSum / weightTotal : NEUTRAL_SCORE);
  });

  return fits;
}

interface TextFit {
  score: number;
  similarCompanies: SimilarCompanyBreakdown[];
  bioSimilarity: number | null;
}

const NO_TEXT_FIT: TextFit = { score: NEUTRAL_SCORE, similarCompanies: [], bioSimilarity: null };

// Text fit: sum-above-threshold similarity between the startup's description and
// (a) a contact's portfolio company descriptions and (b) the contact's own bio
// (see companySimilarity.ts), replacing what used to be TF-IDF word-overlap over
// a bio+description blend. An investor who's backed several genuinely relevant
// companies -- or who describes their own focus similarly to the startup -- now
// outscores one who hasn't, and (unlike TF-IDF) this catches similarity even
// when the text shares no literal words. Also carries along *which* companies
// cleared the threshold, best-first, so the UI can show them on the contact's
// card instead of just the aggregate number.
async function computeTextFits(
  sb: SupabaseClient,
  startupDescription: string,
  contacts: Contact[],
  similarityThreshold: number,
): Promise<Map<string, TextFit>> {
  const fits = new Map<string, TextFit>();
  if (!startupDescription.trim()) {
    for (const c of contacts) fits.set(c.id, NO_TEXT_FIT);
    return fits;
  }

  let startupEmbedding: number[];
  let companyEmbeddings: Map<string, number[]>;
  let bioEmbeddings: Map<string, number[]>;
  try {
    [startupEmbedding, companyEmbeddings, bioEmbeddings] = await Promise.all([
      embedText(startupDescription),
      fetchAllCompanyEmbeddings(sb),
      fetchAllContactBioEmbeddings(sb),
    ]);
  } catch (err) {
    console.error("Company similarity lookup failed, falling back to neutral:", err);
    for (const c of contacts) fits.set(c.id, NO_TEXT_FIT);
    return fits;
  }

  for (const contact of contacts) {
    const portfolio = contact.investments
      .filter((inv) => inv.company_id && companyEmbeddings.has(inv.company_id))
      .map((inv) => ({ companyId: inv.company_id, relationship: inv.relationship }));
    const relevant = relevantPortfolioCompanies(
      startupEmbedding,
      portfolio,
      companyEmbeddings,
      similarityThreshold,
    );

    const bioVec = bioEmbeddings.get(contact.id);
    let bioSimilarity: number | null = null;
    if (bioVec) {
      const sim = cosineSimilarity(startupEmbedding, bioVec);
      if (sim >= BIO_SIMILARITY_THRESHOLD) bioSimilarity = sim;
    }

    if (relevant.length === 0 && bioSimilarity === null) {
      fits.set(contact.id, NO_TEXT_FIT);
      continue;
    }

    const investmentByCompanyId = new Map(contact.investments.map((inv) => [inv.company_id, inv]));
    fits.set(contact.id, {
      score: portfolioRelevanceScore(relevant, bioSimilarity),
      bioSimilarity: bioSimilarity !== null ? round4(bioSimilarity) : null,
      similarCompanies: relevant.map((r) => ({
        companyId: r.companyId,
        companyName: investmentByCompanyId.get(r.companyId)?.company_name ?? "Unknown",
        description: investmentByCompanyId.get(r.companyId)?.description ?? null,
        website: investmentByCompanyId.get(r.companyId)?.website ?? null,
        score: round4(r.score),
      })),
    });
  }

  return fits;
}

export function checkSizeFit(typicalCheckSize: number | null, targetRaise: number | null): number {
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
  verticalFits: Map<string, number>,
  textFits: Map<string, TextFit>,
): ScoredResult[] {
  const normalizedStage = normalizeStage(startup.stage);

  const results: ScoredResult[] = contacts.map((contact) => {
    const verticalScore = verticalFits.get(contact.id) ?? NEUTRAL_SCORE;
    const stageScore = distributionStageFit(ContactFeatureEncoder.stageDistribution(contact), normalizedStage);
    const checkSizeScore = checkSizeFit(ContactFeatureEncoder.typicalCheckSize(contact), startup.targetRaise);
    const textFit = textFits.get(contact.id) ?? NO_TEXT_FIT;

    const breakdown: ScoreBreakdown = {
      vertical: round4(verticalScore),
      stage: round4(stageScore),
      check_size: round4(checkSizeScore),
      text: round4(textFit.score),
      similar_companies: textFit.similarCompanies,
      bio_similarity: textFit.bioSimilarity,
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
  similarityThreshold?: number,
): Promise<{ matchRunId: string; results: ScoredResult[] }> {
  const weights = resolveWeights(weightOverrides);
  const threshold = similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const contacts = await fetchInvestorData(sb);
  const [verticalFits, textFits] = await Promise.all([
    computeVerticalFits(sb, startup.verticals, contacts),
    computeTextFits(sb, startup.description, contacts, threshold),
  ]);
  const results = scoreStartupAgainstInvestors(startup, contacts, weights, verticalFits, textFits);

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
      similarity_threshold: threshold,
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
