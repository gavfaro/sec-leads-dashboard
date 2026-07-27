import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import {
  fetchAllVerticalTagEmbeddings,
  nearestVerticalTags,
  normalizeTag,
} from "@/lib/matching/verticalEmbeddings";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// The ~270-row vertical_tag_embeddings table (plus the verticals name lookup)
// is the same for every request regardless of which company was clicked, and
// barely changes -- refetching it per-request was most of this route's latency
// (it dwarfs the single-row company_embeddings lookup). Memoized per warm
// server instance with a short TTL so newly-added verticals still show up
// without a deploy.
const TAG_CACHE_TTL_MS = 5 * 60 * 1000;
let tagCache: {
  tagEmbeddings: Map<string, number[]>;
  displayNameByTag: Map<string, string>;
  fetchedAt: number;
} | null = null;

async function getTagEmbeddingsAndNames(sb: SupabaseClient) {
  if (tagCache && Date.now() - tagCache.fetchedAt < TAG_CACHE_TTL_MS) {
    return tagCache;
  }
  const [tagEmbeddings, verticalsRes] = await Promise.all([
    fetchAllVerticalTagEmbeddings(sb),
    sb.from("verticals").select("vertical_name"),
  ]);
  const displayNameByTag = new Map(
    (verticalsRes.data ?? []).map((v) => [normalizeTag(v.vertical_name), v.vertical_name]),
  );
  tagCache = { tagEmbeddings, displayNameByTag, fetchedAt: Date.now() };
  return tagCache;
}

// Companies have no structured vertical tags in the DB -- this infers the closest
// ones from the company's already-cached description embedding, purely by
// comparing cached vectors (no live Hugging Face call, no rate limit concern).
export async function GET(req: NextRequest) {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  }

  const sb = getServiceClient();
  try {
    const [companyRes, { tagEmbeddings, displayNameByTag }] = await Promise.all([
      sb.from("company_embeddings").select("embedding").eq("company_id", companyId).maybeSingle(),
      getTagEmbeddingsAndNames(sb),
    ]);
    if (companyRes.error) throw new Error(companyRes.error.message);

    if (!companyRes.data) {
      // No cached embedding yet (e.g. company has no description) -- not an
      // error, just nothing to infer.
      return NextResponse.json({ verticals: [] });
    }

    const nearest = nearestVerticalTags(
      companyRes.data.embedding as number[],
      tagEmbeddings,
      5,
    );

    // vertical_tag_embeddings keys are normalized (trim+lowercase); displayNameByTag
    // maps back to the properly-cased name from the verticals table for display.
    const verticals = nearest.map((n) => ({
      tag: displayNameByTag.get(n.tag) ?? n.tag,
      score: n.score,
    }));

    return NextResponse.json({ verticals });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to infer verticals.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
