// Thin wrapper around Gemini's embedding endpoint. Reuses GEMINI_API_KEY, already
// wired into this app for company enrichment (app/api/enrich/route.ts).
const EMBEDDING_MODEL = "models/gemini-embedding-001";
// Gemini's embedding model supports Matryoshka representation learning, so a
// truncated 768-dim output is still meaningful -- keeps storage and cosine-similarity
// cost small without a real quality hit for short tag-like text.
const EMBEDDING_DIMENSIONS = 768;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parses the "please retry in 46s" style delay Gemini's 429 responses embed in
// their JSON body (error.details[].retryDelay, e.g. "46.9s"), falling back to a
// fixed backoff if the shape isn't there.
function parseRetryDelayMs(body: string, attempt: number): number {
  try {
    const parsed = JSON.parse(body);
    const detail = parsed?.error?.details?.find((d: any) => typeof d?.retryDelay === "string");
    const seconds = parseFloat(detail?.retryDelay ?? "");
    if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000) + 500;
  } catch {
    // fall through to the default backoff below
  }
  return Math.min(2000 * 2 ** attempt, 20000);
}

// This project is on Gemini's free tier (100 embed_content requests/minute), which
// a cold cache blows through instantly once the tag vocabulary is in the hundreds
// (Y Combinator alone has 280+ distinct tags). Retries here handle the occasional
// rate-limit hit gracefully during a live request; the real fix for a cold cache is
// scripts/backfill-vertical-embeddings.ts, run offline ahead of time so live
// requests only ever need to embed a startup's own handful of typed tags.
const MAX_RETRIES = 3;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set -- required for semantic vertical matching.");
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
          // Tuned for "how related are these two short phrases", not classification
          // or retrieval -- verified against hand-picked pairs (e.g. Fintech should
          // rank closer to "Banking as a Service" than to "Vertical Farming").
          taskType: "SEMANTIC_SIMILARITY",
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const values = data?.embedding?.values;
      if (!Array.isArray(values)) {
        throw new Error("Gemini embedding response missing embedding.values");
      }
      return values as number[];
    }

    const body = await res.text().catch(() => "");
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await sleep(parseRetryDelayMs(body, attempt));
      continue;
    }
    throw new Error(`Gemini embedding request failed (${res.status}): ${body}`);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
