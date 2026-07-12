import { createClient } from "@supabase/supabase-js";
import FindInvestors, { CompanyEntry } from "../components/FindInvestors";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function FindInvestorsPage() {
  const sb = getServiceClient();

  const [ciRes, contactsRes, orgsRes, companiesRes] = await Promise.all([
    sb
      .from("contact_investments")
      .select("contact_id, company_id, relationship"),
    sb
      .from("contacts")
      .select("id, first_name, last_name, role, linkedin_url, org_id"),
    sb.from("organizations").select("id, name"),
    sb.from("companies").select("id, name, description"),
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

      <FindInvestors companies={companies} />
    </div>
  );
}
