import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchResultEntry, MatchRunEntry } from "@/app/components/MatchingEngine";

// Shared between app/find-investors/page.tsx (bulk listing) and
// app/api/match/route.ts (single freshly-created run) so both shape rows the same way.
export const MATCH_RESULT_SELECT =
  "match_run_id, rank, score, score_breakdown, contact_id, " +
  "contacts(first_name, last_name, role, linkedin_url, bio, org_id, " +
  "organizations(name), " +
  "contact_investments(relationship, companies(id, name, description)))";

export function shapeMatchResultRow(row: any): MatchResultEntry {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  const org = Array.isArray(contact?.organizations)
    ? contact.organizations[0]
    : contact?.organizations;
  return {
    contactId: row.contact_id,
    firstName: contact?.first_name ?? "Unknown",
    lastName: contact?.last_name ?? "",
    role: contact?.role ?? null,
    linkedinUrl: contact?.linkedin_url ?? null,
    bio: contact?.bio ?? null,
    investments: contact?.contact_investments ?? [],
    orgId: contact?.org_id ?? "",
    orgName: org?.name ?? "Unknown",
    rank: row.rank,
    score: row.score,
    scoreBreakdown: row.score_breakdown,
  };
}

export function shapeMatchRun(
  run: { id: string; startup_name: string; startup_input: unknown; created_at: string | null },
  results: MatchResultEntry[],
): MatchRunEntry {
  const input = (run.startup_input ?? {}) as {
    verticals?: string[];
    stage?: string;
    target_raise?: number;
    description?: string;
  };
  return {
    id: run.id,
    startupName: run.startup_name,
    verticals: input.verticals ?? [],
    stage: input.stage ?? null,
    targetRaise: input.target_raise ?? null,
    description: input.description ?? null,
    createdAt: run.created_at,
    results,
  };
}

export async function fetchMatchRun(
  sb: SupabaseClient,
  matchRunId: string,
): Promise<MatchRunEntry | null> {
  const [runRes, resultsRes] = await Promise.all([
    sb
      .from("match_runs")
      .select("id, startup_name, startup_input, created_at")
      .eq("id", matchRunId)
      .maybeSingle(),
    sb
      .from("match_results")
      .select(MATCH_RESULT_SELECT)
      .eq("match_run_id", matchRunId)
      .order("rank"),
  ]);

  if (!runRes.data) return null;
  const results = (resultsRes.data ?? []).map(shapeMatchResultRow);
  return shapeMatchRun(runRes.data, results);
}
