// Thin wrapper around a Hugging Face-hosted sentence-transformers model, called
// live for the small, occasional embeddings a match request needs (a startup's
// typed verticals + description). Bulk embedding (every company description,
// every vertical tag) runs as a *local* model via scripts/embed_local.py instead --
// no API calls, no rate limit, since that's thousands of calls and this project's
// HF token is free-tier. Both paths MUST use the exact same model: vectors from two
// different models live in different, incomparable spaces.
const MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}/pipeline/feature-extraction`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 3;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not set -- required for semantic vertical matching.");
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(INFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (res.ok) {
      const data = await res.json();
      // A single string input returns a flat number[]; be defensive in case a
      // future model/response shape nests it as [number[]] instead.
      const values = Array.isArray(data?.[0]) ? data[0] : data;
      if (!Array.isArray(values) || typeof values[0] !== "number") {
        throw new Error("Hugging Face embedding response had an unexpected shape");
      }
      return values as number[];
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : NaN;
      await sleep(Number.isFinite(retryAfterMs) ? retryAfterMs : Math.min(2000 * 2 ** attempt, 20000));
      continue;
    }

    const body = await res.text().catch(() => "");
    throw new Error(`Hugging Face embedding request failed (${res.status}): ${body}`);
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
