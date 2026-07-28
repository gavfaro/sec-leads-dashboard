import type { SupabaseClient } from "@supabase/supabase-js";
import { cosineSimilarity } from "./embeddings";

// Calibrated against real company descriptions (see PR discussion): two genuinely
// related businesses (e.g. two security/compliance platforms) scored ~0.48 cosine
// similarity under this model, while unrelated pairs clustered at 0.0-0.18. 0.3
// cleanly separates "relevant" from "noise" for paragraph-length description text
// -- a tighter band than short vertical-tag comparisons, since longer text embeds
// more diffusely. Exposed as a per-run override (Match Settings in the UI) since
// this calibration is a reasonable default, not a hard law.
export const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

// Bios need their own, lower threshold: they're short, narrative/biographical
// text (career history, alma mater, personal background mixed in with focus
// areas) rather than a pure product description, so they embed far more
// diffusely and score systematically lower even when genuinely on-topic.
// Calibrated against real examples: bios that explicitly state a matching
// investment focus (e.g. "focuses on cybersecurity" against a security-scanning
// startup) scored 0.31-0.62, while unrelated bios (sports, real estate, no
// stated focus at all) clustered at -0.05-0.11 -- 0.2 sits cleanly in the gap.
export const BIO_SIMILARITY_THRESHOLD = 0.2;

// Squashes an unbounded "sum of similarities" into 0-1 with diminishing returns,
// so a contact with many relevant portfolio companies scores higher than one with
// few, but no portfolio can ever push the score past 1. k=2 means roughly 3-4
// solidly-relevant companies (sum ~1.5-2) lands around 0.55-0.63.
function saturate(sum: number, k = 2): number {
  return 1 - Math.exp(-sum / k);
}

// Multi-fund vehicles (e.g. Alumni Ventures) can rack up 50-100+ relevant
// companies -- with current investments counted double and no cap, that blows
// straight through the saturation curve above, so every prolific investor pins
// at text=1.0 and becomes indistinguishable from one with a tight, 10-company
// bench. Capping to the top N (already sorted best-first) bounds `sum` to a
// range the curve was actually calibrated for, so score still differentiates
// "very well covered" from "extremely well covered" -- once a portfolio has
// proven ~10 genuinely relevant companies, more of the same shouldn't keep
// inflating the score on sheer portfolio size alone.
const MAX_RELEVANT_COMPANIES = 10;

// A match run needs embeddings for essentially every company any scored contact
// has touched, which in practice is most of the table -- so this just pulls the
// whole (fully-cached, ~a few thousand row) company_embeddings table via plain
// pagination instead of filtering by a huge .in() id list. That filter used to
// need defensive chunking: a 500-UUID .in() list builds an ~18.6KB request URL,
// which trips Node undici's ~16KB default response header limit
// (UND_ERR_HEADERS_OVERFLOW, confirmed empirically). Fetching everything sidesteps
// that class of bug entirely and needs no knowledge of which ids are relevant
// up front.
export async function fetchAllCompanyEmbeddings(
  sb: SupabaseClient,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const PAGE_SIZE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from("company_embeddings")
      .select("company_id, embedding")
      // Without a deterministic order, rows can come back in a different
      // sequence between page requests (especially with concurrent inserts,
      // e.g. an active scraper run), silently skipping or duplicating rows
      // across the paginated fetch -- the same class of bug documented at
      // app/page.tsx's .range() call. company_id is the primary key, so
      // ordering by it alone is already a stable tiebreaker.
      .order("company_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      result.set(row.company_id, row.embedding as number[]);
    }
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return result;
}

// Same fetch-all-and-cache-in-memory approach as fetchAllCompanyEmbeddings, for
// contact bios instead of company descriptions (see scripts/embed_local.py).
// Before this, a contact's own stated thesis played no role in the text score at
// all -- it switched from a TF-IDF blend of bio+descriptions to pure
// portfolio-company similarity, leaving the bio unused except as a last-resort
// vertical-inference input (see encoder.ts/matcher.ts's tier-3 fallback).
export async function fetchAllContactBioEmbeddings(
  sb: SupabaseClient,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const PAGE_SIZE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from("contact_bio_embeddings")
      .select("contact_id, embedding")
      // See fetchAllCompanyEmbeddings above -- same stable-order requirement
      // for multi-page .range() fetches.
      .order("contact_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      result.set(row.contact_id, row.embedding as number[]);
    }
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return result;
}

export interface PortfolioCompany {
  companyId: string | null;
  relationship: string | null;
}

export interface RelevantCompany {
  companyId: string;
  relationship: string | null;
  score: number;
}

// Filters a contact's portfolio down to companies that cleared the relevance
// threshold against the startup's embedding, sorted best-first. This is the same
// set the text score is computed from, surfaced separately so the UI can show
// *which* companies drove a contact's text score, not just the number.
export function relevantPortfolioCompanies(
  startupEmbedding: number[],
  portfolio: PortfolioCompany[],
  embeddings: Map<string, number[]>,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): RelevantCompany[] {
  const relevant: RelevantCompany[] = [];
  for (const { companyId, relationship } of portfolio) {
    if (!companyId) continue;
    const companyVec = embeddings.get(companyId);
    if (!companyVec) continue;
    const score = cosineSimilarity(startupEmbedding, companyVec);
    if (score >= threshold) relevant.push({ companyId, relationship, score });
  }
  return relevant.sort((a, b) => b.score - a.score).slice(0, MAX_RELEVANT_COMPANIES);
}

// Sum of similarities across a contact's already-thresholded relevant companies
// (plus, optionally, their own bio similarity), squashed to 0-1. Rewards backing
// *many* relevant companies, not just the single best match -- an investor who's
// backed 3 relevant companies should outrank one who's backed just 1, even if
// that 1 is a slightly closer match. Current investments count double, and a
// bio clearing the threshold counts the same as a current investment -- a
// partner's stated thesis is at least as strong a signal of what they're
// looking for right now as their active portfolio is.
export function portfolioRelevanceScore(
  relevant: RelevantCompany[],
  bioSimilarity: number | null = null,
): number {
  let sum = 0;
  for (const { relationship, score } of relevant) {
    sum += relationship === "current" ? score * 2 : score;
  }
  if (bioSimilarity !== null) sum += bioSimilarity * 2;
  return saturate(sum);
}
