import { createClient } from "@supabase/supabase-js";
import FindInvestorsHub from "../components/FindInvestorsHub";
import { CompanyEntry } from "../components/FindInvestors";
import { MatchRunEntry } from "../components/MatchingEngine";
import { MATCH_RESULT_SELECT, shapeMatchResultRow, shapeMatchRun } from "@/lib/matchRuns";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function FindInvestorsPage() {
  const sb = getServiceClient();
  // Saved matches are per-account: read through the session client so the
  // select_own_match_runs / select_own_match_results RLS policies scope these two
  // queries automatically, same pattern as saved_searches. Shared investor/company
  // data below stays on the service-role client -- it isn't user-owned.
  const sbSession = await createSessionClient();

  const [ciRes, contactsRes, orgsRes, companiesRes, verticalsRes, matchRunsRes, matchResultsRes] =
    await Promise.all([
      sb
        .from("contact_investments")
        .select("contact_id, company_id, relationship"),
      sb
        .from("contacts")
        .select("id, first_name, last_name, role, linkedin_url, org_id"),
      sb.from("organizations").select("id, name"),
      sb.from("companies").select("id, name, description"),
      sb.from("verticals").select("vertical_name").order("vertical_name"),
      sbSession
        .from("match_runs")
        .select("id, startup_name, startup_input, created_at")
        .order("created_at", { ascending: false }),
      sbSession.from("match_results").select(MATCH_RESULT_SELECT).order("rank"),
    ]);

  const contactMap = new Map(
    (contactsRes.data ?? []).map((c) => [c.id, c]),
  );
  const orgMap = new Map(
    (orgsRes.data ?? []).map((o) => [o.id, o]),
  );

  // Build company → investors index
  const companyInvestors = new Map<string, CompanyEntry["investors"]>();
  for (const ci of ciRes.data ?? []) {
    const contact = contactMap.get(ci.contact_id);
    if (!contact) continue;
    const org = orgMap.get(contact.org_id);
    if (!companyInvestors.has(ci.company_id)) {
      companyInvestors.set(ci.company_id, []);
    }
    companyInvestors.get(ci.company_id)!.push({
      contactId: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      role: contact.role ?? null,
      linkedin_url: contact.linkedin_url ?? null,
      orgId: contact.org_id,
      orgName: org?.name ?? "Unknown",
      relationship: ci.relationship,
    });
  }

  // Only include companies that have at least one investor (by design invariant)
  const companies: CompanyEntry[] = (companiesRes.data ?? [])
    .filter((co) => companyInvestors.has(co.id))
    .map((co) => ({
      id: co.id,
      name: co.name,
      description: co.description ?? null,
      investors: companyInvestors.get(co.id)!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group match_results by run, joined with the run's own metadata
  const resultsByRun = new Map<string, MatchRunEntry["results"]>();
  for (const r of (matchResultsRes.data ?? []) as any[]) {
    if (!resultsByRun.has(r.match_run_id)) resultsByRun.set(r.match_run_id, []);
    resultsByRun.get(r.match_run_id)!.push(shapeMatchResultRow(r));
  }

  const matchRuns: MatchRunEntry[] = (matchRunsRes.data ?? []).map((run) =>
    shapeMatchRun(run, resultsByRun.get(run.id) ?? []),
  );

  const verticals = (verticalsRes.data ?? []).map((v) => v.vertical_name);

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black pb-16">
      <header className="mb-6 border-b-4 border-white pb-4 flex flex-wrap gap-4 justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase text-white">
            Find Investors
          </h1>
          <p className="text-sm font-bold mt-1 text-zinc-500 uppercase tracking-wider">
            Match your startup to partners by portfolio overlap
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-sm font-bold bg-zinc-100 px-4 py-2 border-2 border-black uppercase tracking-wide">
            {companies.length} Companies indexed
          </div>
        </div>
      </header>

      <FindInvestorsHub companies={companies} matchRuns={matchRuns} verticals={verticals} />
    </div>
  );
}
