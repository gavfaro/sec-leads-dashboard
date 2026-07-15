import { createClient } from "@supabase/supabase-js";
import InvestorExplorer, { OrgRow, PartnerRow } from "../components/InvestorExplorer";

export const dynamic = "force-dynamic";

// Service role key required — RLS blocks anon key on organizations/contacts reads.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function InvestorsPage() {
  const sb = getServiceClient();

  const [orgsRes, contactsRes, investmentsRes] = await Promise.all([
    sb
      .from("organizations")
      .select("id, name, website, entity_types(type_name)")
      .order("name"),
    sb
      .from("contacts")
      .select(
        `id, first_name, last_name, role, linkedin_url, bio, org_id,
         contact_investments(relationship, companies(id, name, description))`,
      )
      .order("last_name"),
    sb.from("portfolio_investments").select("org_id, company_id"),
  ]);

  if (orgsRes.error) {
    return (
      <div className="p-4 m-4 border-2 border-black bg-red-500 text-white font-bold uppercase">
        Error loading firms: {orgsRes.error.message}
      </div>
    );
  }

  const rawOrgs = orgsRes.data ?? [];
  const rawContacts = (contactsRes.data ?? []) as any[];

  const orgMap: Record<string, string> = Object.fromEntries(
    rawOrgs.map((o) => [o.id, o.name]),
  );

  // Partner counts per org
  const partnerCounts: Record<string, number> = {};
  for (const c of rawContacts) {
    partnerCounts[c.org_id] = (partnerCounts[c.org_id] ?? 0) + 1;
  }

  // Distinct portfolio companies per org
  const companyCountMap: Record<string, Set<string>> = {};
  for (const pi of investmentsRes.data ?? []) {
    if (!companyCountMap[pi.org_id]) companyCountMap[pi.org_id] = new Set();
    companyCountMap[pi.org_id].add(pi.company_id);
  }

  function pickCompany(c: any) {
    if (!c) return null;
    return Array.isArray(c) ? (c[0] ?? null) : c;
  }

  const orgs: OrgRow[] = rawOrgs.map((org: any) => ({
    id: org.id,
    name: org.name,
    website: org.website ?? null,
    typeName: Array.isArray(org.entity_types)
      ? (org.entity_types[0]?.type_name ?? null)
      : (org.entity_types?.type_name ?? null),
    partnerCount: partnerCounts[org.id] ?? 0,
    companyCount: companyCountMap[org.id]?.size ?? 0,
  }));

  const partners: PartnerRow[] = rawContacts.map((c: any) => {
    const investments: any[] = c.contact_investments ?? [];
    const currentCompanies = investments
      .filter((ci: any) => ci.relationship === "current")
      .map((ci: any) => pickCompany(ci.companies))
      .filter(Boolean);
    const previousCompanies = investments
      .filter((ci: any) => ci.relationship === "previous")
      .map((ci: any) => pickCompany(ci.companies))
      .filter(Boolean);

    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      role: c.role ?? null,
      linkedin_url: c.linkedin_url ?? null,
      bio: c.bio ?? null,
      orgId: c.org_id,
      orgName: orgMap[c.org_id] ?? "Unknown",
      investmentCount: investments.length,
      currentCompanies,
      previousCompanies,
    };
  });

  const totalPartners = rawContacts.length;
  const totalCompanies = new Set(
    (investmentsRes.data ?? []).map((pi) => pi.company_id),
  ).size;

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black pb-16">
      <header className="mb-6 border-b-4 border-black pb-4 flex flex-wrap gap-4 justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Investor Intelligence
          </h1>
          <p className="text-sm font-bold mt-1 text-zinc-500 uppercase tracking-wider">
            VC Firm &amp; Partner Database
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-sm font-bold bg-[#10B981] px-4 py-2 border-2 border-black uppercase tracking-wide">
            {orgs.length} Firms
          </div>
          <div className="text-sm font-bold bg-zinc-100 px-4 py-2 border-2 border-black uppercase tracking-wide">
            {totalPartners} Partners
          </div>
          <div className="text-sm font-bold bg-zinc-100 px-4 py-2 border-2 border-black uppercase tracking-wide">
            {totalCompanies} Companies
          </div>
        </div>
      </header>

      {orgs.length === 0 ? (
        <div className="border-2 border-black p-16 text-center font-black uppercase text-xl text-zinc-400">
          No firms scraped yet.
          <p className="text-sm mt-2 font-bold text-zinc-400">
            Run{" "}
            <span className="font-mono bg-zinc-100 px-2 py-0.5 border border-zinc-300">
              python investor_scraper/scraper.py team sequoia
            </span>{" "}
            to populate this page.
          </p>
        </div>
      ) : (
        <InvestorExplorer orgs={orgs} partners={partners} />
      )}
    </div>
  );
}
