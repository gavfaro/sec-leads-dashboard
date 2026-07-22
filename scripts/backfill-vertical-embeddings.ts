// One-time (and periodically re-runnable) maintenance script: embeds every
// distinct vertical tag in the database and caches it in vertical_tag_embeddings,
// so live match requests (app/api/match/route.ts -> lib/matching/matcher.ts) only
// ever need to embed a startup's own handful of typed tags, not the whole
// investor-side vocabulary. Processes tags one at a time with deliberate pacing to
// stay under Gemini's free-tier 100-requests/minute embed_content quota -- run this
// whenever a newly-scraped firm adds a lot of brand-new tags.
//
// Uses plain REST calls to Supabase (not @supabase/supabase-js) -- that package's
// realtime client requires a native WebSocket that this Node version doesn't have
// standalone (outside Next.js's runtime), and this script only needs simple
// select/upsert.
//
// Usage: npx tsx scripts/backfill-vertical-embeddings.ts
import fs from "fs";
import path from "path";

for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8").split("\n")) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

import { embedText } from "../lib/matching/embeddings";
import { normalizeTag } from "../lib/matching/verticalEmbeddings";

// ~85/min, comfortably under the 100/min free-tier quota.
const DELAY_MS = 700;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function restGet(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function restUpsertTag(tag: string, embedding: number[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/vertical_tag_embeddings`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ tag, embedding }),
  });
  if (!res.ok) throw new Error(`Upsert failed (${res.status}): ${await res.text()}`);
}

async function main() {
  const verticals = await restGet("verticals?select=vertical_name");
  const cached = await restGet("vertical_tag_embeddings?select=tag");
  const cachedSet = new Set(cached.map((r) => r.tag));

  const allTags = [...new Set(verticals.map((v) => normalizeTag(v.vertical_name)))];
  const missing = allTags.filter((t) => t && !cachedSet.has(t));

  console.log(`${allTags.length} distinct tags total, ${missing.length} not yet cached.`);

  let done = 0;
  let failed = 0;
  for (const tag of missing) {
    try {
      const embedding = await embedText(tag);
      await restUpsertTag(tag, embedding);
      done++;
      process.stdout.write(`\r  embedded ${done}/${missing.length} (${failed} failed)`);
    } catch (err) {
      failed++;
      console.error(`\nFailed to embed "${tag}":`, err instanceof Error ? err.message : err);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${done} embedded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
