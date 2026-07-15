import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMatchRun } from "@/lib/matchRuns";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { runMatch } from "@/lib/matching/matcher";
import type { StartupInput } from "@/lib/matching/types";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface MatchRequestBody {
  name?: string;
  verticals?: string[];
  stage?: string;
  targetRaise?: number;
  description?: string;
  location?: string;
}

export async function POST(req: NextRequest) {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: MatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Startup name is required." }, { status: 400 });
  }

  const startup: StartupInput = {
    name,
    verticals: body.verticals ?? [],
    stage: body.stage ?? null,
    targetRaise:
      typeof body.targetRaise === "number" && Number.isFinite(body.targetRaise)
        ? body.targetRaise
        : null,
    description: body.description ?? "",
    location: body.location ?? null,
  };

  const sb = getServiceClient();

  let matchRunId: string;
  try {
    // Runs natively in this Node process now -- no subprocess, no Python, so this
    // works the same on Vercel's serverless functions as it does locally.
    const result = await runMatch(sb, startup);
    matchRunId = result.matchRunId;
  } catch (err) {
    return NextResponse.json(
      { error: "Matching engine failed to run.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // runMatch writes via the service-role client, which has no notion of web
  // sessions, so ownership is stamped on here. There's no UPDATE RLS policy on
  // match_runs -- an unowned row can't be claimed through the user's own session
  // client -- so this specific step has to use the service-role client.
  const { error: ownerError } = await sb
    .from("match_runs")
    .update({ user_id: user.id })
    .eq("id", matchRunId);
  if (ownerError) {
    return NextResponse.json(
      { error: "Match run was created but could not be assigned to your account.", detail: ownerError.message },
      { status: 500 },
    );
  }

  const run = await fetchMatchRun(sb, matchRunId);
  if (!run) {
    return NextResponse.json(
      { error: "Match run was created but could not be re-fetched." },
      { status: 500 },
    );
  }

  return NextResponse.json({ run });
}
