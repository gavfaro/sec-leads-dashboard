import { createClient } from "@supabase/supabase-js";
import FindInvestorsHub from "../components/FindInvestorsHub";
import { CompanyEntry } from "../components/FindInvestors";
import { MatchRunEntry } from "../components/MatchingEngine";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function FindInvestorsPage() {
  const sb = getServiceClient();

  const [ciRes, contactsRes, orgsRes, companiesRes, matchRunsRes, matchResultsRes] =
    await Promise.all([
      sb
        .from("contact_investments")
        .select("contact_id, company_id, relationship"),
      sb
        .from("contacts")
        .select("id, first_name, last_name, role, linkedin_url, org_id"),
      sb.from("organizations").select("id, name"),
      sb.from("companies").select("id, name, description"),
      sb
        .from("match_runs")
        .select("id, startup_name, startup_input, created_at")
        .order("created_at", { ascending: false }),
      sb
        .from("match_results")
        .select(
          "match_run_id, rank, score, score_breakdown, contact_id, " +
            "contacts(first_name, last_name, role, linkedin_url, bio, org_id, " +
            "organizations(name), " +
            "contact_investments(relationship, companies(id, name, description)))",
        )
        .order("rank"),
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
    const contact = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
    const org = Array.isArray(contact?.organizations)
      ? contact.organizations[0]
      : contact?.organizations;
    if (!resultsByRun.has(r.match_run_id)) resultsByRun.set(r.match_run_id, []);
    resultsByRun.get(r.match_run_id)!.push({
      contactId: r.contact_id,
      firstName: contact?.first_name ?? "Unknown",
      lastName: contact?.last_name ?? "",
      role: contact?.role ?? null,
      linkedinUrl: contact?.linkedin_url ?? null,
      bio: contact?.bio ?? null,
      investments: contact?.contact_investments ?? [],
      orgId: contact?.org_id ?? "",
      orgName: org?.name ?? "Unknown",
      rank: r.rank,
      score: r.score,
      scoreBreakdown: r.score_breakdown,
    });
  }

  const matchRuns: MatchRunEntry[] = (matchRunsRes.data ?? []).map((run) => {
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
      results: resultsByRun.get(run.id) ?? [],
    };
  });

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black pb-16">
      <header className="mb-6 border-b-4 border-black pb-4 flex flex-wrap gap-4 justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
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

      <FindInvestorsHub companies={companies} matchRuns={matchRuns} />
    </div>
  );
}
