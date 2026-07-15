import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMatchRun } from "@/lib/matchRuns";

const execFileAsync = promisify(execFile);

// Repo root == Next.js app root here, so process.cwd() at request time is the repo root.
const REPO_ROOT = process.cwd();
const PYTHON_BIN = path.join(REPO_ROOT, ".venv", "bin", "python3");
const MATCHER_SCRIPT = path.join(REPO_ROOT, "math_engine", "matcher.py");
const MATH_ENGINE_DIR = path.join(REPO_ROOT, "math_engine");

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

  // Passed as an argv array via execFile (no shell), so nothing here is ever
  // interpreted as shell syntax -- safe even though it's all user-supplied text.
  const args = [MATCHER_SCRIPT, "--name", name, "--top", "0"];
  if (body.verticals?.length) {
    args.push("--verticals", body.verticals.join(","));
  }
  if (body.stage) {
    args.push("--stage", body.stage);
  }
  if (typeof body.targetRaise === "number" && Number.isFinite(body.targetRaise)) {
    args.push("--target-raise", String(body.targetRaise));
  }
  if (body.description) {
    args.push("--description", body.description);
  }
  if (body.location) {
    args.push("--location", body.location);
  }

  let stdout: string;
  try {
    const result = await execFileAsync(PYTHON_BIN, args, {
      cwd: MATH_ENGINE_DIR,
      timeout: 60_000,
    });
    stdout = result.stdout;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Matching engine failed to run.", detail: err?.stderr ?? err?.message ?? String(err) },
      { status: 500 },
    );
  }

  const match = stdout.match(/match_run_id:\s*([0-9a-fA-F-]+)/);
  const matchRunId = match?.[1];
  if (!matchRunId) {
    return NextResponse.json(
      { error: "Could not read match_run_id from matcher output.", detail: stdout },
      { status: 500 },
    );
  }

  const sb = getServiceClient();
  const run = await fetchMatchRun(sb, matchRunId);
  if (!run) {
    return NextResponse.json(
      { error: "Match run was created but could not be re-fetched." },
      { status: 500 },
    );
  }

  return NextResponse.json({ run });
}
