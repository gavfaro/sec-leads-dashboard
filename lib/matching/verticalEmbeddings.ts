import type { SupabaseClient } from "@supabase/supabase-js";
import { cosineSimilarity, embedText } from "./embeddings";

// Cap on concurrent embedding calls when warming a cold cache (e.g. the first
// time a brand-new firm's tags show up) -- keeps us from bursting past Gemini's
// per-minute rate limit when hundreds of tags need embedding at once.
const EMBED_CONCURRENCY = 10;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

async function embedInBatches(tags: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  for (let i = 0; i < tags.length; i += EMBED_CONCURRENCY) {
    const batch = tags.slice(i, i + EMBED_CONCURRENCY);
    const embedded = await Promise.all(
      batch.map(async (tag) => ({ tag, embedding: await embedText(tag) })),
    );
    for (const { tag, embedding } of embedded) {
      result.set(tag, embedding);
    }
  }
  return result;
}

// Returns normalized-tag -> embedding for every tag in `tags`, fetching from the
// vertical_tag_embeddings cache first and only calling the embeddings API (then
// caching the result) for whatever isn't already there.
export async function getOrCreateEmbeddings(
  sb: SupabaseClient,
  tags: string[],
): Promise<Map<string, number[]>> {
  const uniqueTags = [...new Set(tags.map(normalizeTag))].filter(Boolean);
  if (uniqueTags.length === 0) return new Map();

  const { data: cached, error } = await sb
    .from("vertical_tag_embeddings")
    .select("tag, embedding")
    .in("tag", uniqueTags);
  if (error) throw new Error(error.message);

  const result = new Map<string, number[]>();
  for (const row of cached ?? []) {
    result.set(row.tag, row.embedding as number[]);
  }

  const missing = uniqueTags.filter((t) => !result.has(t));
  if (missing.length === 0) return result;

  const freshlyEmbedded = await embedInBatches(missing);
  for (const [tag, embedding] of freshlyEmbedded) {
    result.set(tag, embedding);
  }

  // Best-effort cache write -- a failure here shouldn't fail the match itself,
  // just means these tags get re-embedded next time.
  const { error: upsertError } = await sb.from("vertical_tag_embeddings").upsert(
    [...freshlyEmbedded.entries()].map(([tag, embedding]) => ({ tag, embedding })),
    { onConflict: "tag" },
  );
  if (upsertError) {
    console.error("Failed to cache vertical tag embeddings:", upsertError.message);
  }

  return result;
}

// Every vertical tag's embedding is already cached (see scripts/embed_local.py),
// and there are only ~270 of them -- cheap to pull in full for a company-vertical
// inference lookup rather than filtering by a specific tag list.
export async function fetchAllVerticalTagEmbeddings(
  sb: SupabaseClient,
): Promise<Map<string, number[]>> {
  const { data, error } = await sb.from("vertical_tag_embeddings").select("tag, embedding");
  if (error) throw new Error(error.message);
  const result = new Map<string, number[]>();
  for (const row of data ?? []) {
    result.set(row.tag, row.embedding as number[]);
  }
  return result;
}

export interface InferredVertical {
  tag: string;
  score: number;
}

// Companies have no structured vertical tags at all (no company_verticals table
// exists), so this infers them the same way the rest of the matching engine
// handles fragmented/missing tags: nearest neighbors in embedding space, not a
// hand-maintained keyword list. Used to show "what sector is this company in"
// on the company description popup.
export function nearestVerticalTags(
  companyEmbedding: number[],
  tagEmbeddings: Map<string, number[]>,
  topN = 5,
): InferredVertical[] {
  const scored: InferredVertical[] = [];
  for (const [tag, vec] of tagEmbeddings) {
    scored.push({ tag, score: cosineSimilarity(companyEmbedding, vec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
