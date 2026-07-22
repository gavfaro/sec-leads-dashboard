import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import FirmContacts, { ContactWithInvestments } from "../../components/FirmContacts";
import PortfolioSection, { PortfolioCompany } from "../../components/PortfolioSection";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const PORTFOLIO_PAGE_SIZE = 200;

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ p?: string }>;
}

export default async function FirmDetailPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;
  const { p } = await searchParams;
  const portfolioPage = Math.max(0, (parseInt(p ?? "1", 10) || 1) - 1); // 0-indexed

  const sb = getServiceClient();

  const [orgRes, contactsRes, portfolioRes] = await Promise.all([
    sb
      .from("organizations")
      .select("id, name, website, entity_types(type_name)")
      .eq("id", orgId)
      .maybeSingle(),
    sb
      .from("contacts")
      .select(
        `id, first_name, last_name, role, linkedin_url, bio,
         contact_investments(
           relationship,
           companies(id, name, description)
         )`,
      )
      .eq("org_id", orgId)
      .order("last_name"),
    sb
      .from("portfolio_investments")
      .select("investment_stage, companies(id, name, website, description)", { count: "exact" })
      .eq("org_id", orgId)
      .range(portfolioPage * PORTFOLIO_PAGE_SIZE, (portfolioPage + 1) * PORTFOLIO_PAGE_SIZE - 1),
  ]);

  if (!orgRes.data) {
    return (
      <div className="max-w-4xl mx-auto p-6 mt-12 border-2 border-black bg-zinc-100 font-bold uppercase text-black">
        Firm not found.
        <div className="mt-4">
          <Link href="/investors" className="underline text-[#2596BE]">
            ← Back to Investors
          </Link>
        </div>
      </div>
    );
  }

  const org = orgRes.data as any;
  const contacts = (contactsRes.data ?? []) as unknown as ContactWithInvestments[];
  const totalCompanies = portfolioRes.count ?? 0;
  const totalPortfolioPages = Math.ceil(totalCompanies / PORTFOLIO_PAGE_SIZE);

  const portfolioCompanies: PortfolioCompany[] = (portfolioRes.data ?? [])
    .map((pi: any) => {
      const co = Array.isArray(pi.companies) ? pi.companies[0] : pi.companies;
      if (!co?.id) return null;
      return {
        id: co.id,
        name: co.name ?? "",
        website: co.website ?? null,
        description: co.description ?? null,
        stage: pi.investment_stage ?? null,
      };
    })
    .filter(Boolean) as PortfolioCompany[];

  const typeName = Array.isArray(org.entity_types)
    ? org.entity_types[0]?.type_name
    : org.entity_types?.type_name;

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black pb-16">
      {/* Back nav */}
      <nav className="mb-6">
        <Link
          href="/investors"
          className="inline-block px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
        >
          ← All Firms
        </Link>
      </nav>

      {/* Firm header */}
      <header className="mb-8 border-4 border-black p-6 bg-white">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            {typeName && (
              <span className="text-[9px] font-black uppercase tracking-wider bg-[#2596BE] px-2 py-0.5 border border-black">
                {typeName}
              </span>
            )}
            <h1 className="text-4xl font-black uppercase tracking-tight mt-2">
              {org.name}
            </h1>
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-zinc-500 hover:text-[#2596BE] mt-1 inline-block"
              >
                {org.website.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
          </div>

          <div className="flex gap-4 font-mono">
            <div className="border-2 border-black p-3 text-center bg-[#2596BE]/10">
              <span className="text-3xl font-black tabular-nums block leading-none">
                {contacts.length}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600 block mt-1">
                Partners
              </span>
            </div>
            <div className="border-2 border-black p-3 text-center bg-zinc-50">
              <span className="text-3xl font-black tabular-nums block leading-none">
                {totalCompanies}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600 block mt-1">
                Companies
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Partner grid via client component (handles click-to-modal) */}
      {contacts.length === 0 ? (
        <div className="border-2 border-black p-12 text-center font-black uppercase text-xl text-zinc-400">
          No partners scraped yet for this firm.
        </div>
      ) : (
        <FirmContacts contacts={contacts} />
      )}

      {/* Full portfolio company list */}
      {totalCompanies > 0 && (
        <PortfolioSection
          companies={portfolioCompanies}
          page={portfolioPage + 1}
          totalPages={totalPortfolioPages}
          totalCount={totalCompanies}
          orgId={orgId}
        />
      )}
    </div>
  );
}
