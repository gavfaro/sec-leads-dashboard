import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import FilterForm from "./components/FilterForm"; // Import our new Client Component

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ITEMS_PER_PAGE = 15;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    name?: string;
    cik?: string;
    city?: string;
    state?: string;
    industry?: string;
    entityType?: string;
    fundType?: string;
    type?: string;
    minRaise?: string;
    maxRaise?: string;
    offeringType?: string;
    minSold?: string;
    maxSold?: string;
    minCheck?: string;
    maxCheck?: string;
    revenueRange?: string;
    exemption?: string;
    accredited?: string;
    phoneOnly?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }>;
}

const FILTER_KEYS = [
  "name",
  "cik",
  "city",
  "state",
  "industry",
  "entityType",
  "fundType",
  "type",
  "minRaise",
  "maxRaise",
  "offeringType",
  "minSold",
  "maxSold",
  "minCheck",
  "maxCheck",
  "revenueRange",
  "exemption",
  "accredited",
  "phoneOnly",
  "dateFrom",
  "dateTo",
  "sort",
] as const;

function getSecUrls(cik: number | string, accessionNumber: string) {
  if (!accessionNumber || !cik) return { indexUrl: "#", xmlUrl: "#" };
  const folderNum = accessionNumber.replace(/-/g, "");
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${folderNum}`;
  return {
    indexUrl: `${baseUrl}/${accessionNumber}-index.htm`,
    xmlUrl: `${baseUrl}/primary_doc.xml`,
  };
}

export default async function SECDashboard({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  // 1. Extract URL Parameters
  const currentPage = Math.max(1, parseInt(resolvedParams.page || "1", 10));
  const nameSearch = resolvedParams.name || "";
  const cik = resolvedParams.cik || "";
  const city = resolvedParams.city || "";
  const stateCode = resolvedParams.state || "";
  const industry = resolvedParams.industry || "";
  const entityType = resolvedParams.entityType || "";
  const fundType = resolvedParams.fundType || "";
  const submissionType = resolvedParams.type || "";
  const minRaise = parseInt(resolvedParams.minRaise || "", 10);
  const maxRaise = parseInt(resolvedParams.maxRaise || "", 10);
  const offeringType = resolvedParams.offeringType || "";
  const minSold = parseInt(resolvedParams.minSold || "", 10);
  const maxSold = parseInt(resolvedParams.maxSold || "", 10);
  const minCheck = parseInt(resolvedParams.minCheck || "", 10);
  const maxCheck = parseInt(resolvedParams.maxCheck || "", 10);
  const revenueRange = resolvedParams.revenueRange || "";
  const exemption = resolvedParams.exemption || "";
  const accredited = resolvedParams.accredited || "";
  const phoneOnly = resolvedParams.phoneOnly === "true";
  const dateFrom = resolvedParams.dateFrom || "";
  const dateTo = resolvedParams.dateTo || "";
  const sort = resolvedParams.sort || "date_desc";

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // 2. Build the Supabase Query Dynamically
  let query = supabase
    .from("company_fundraising_profiles")
    .select(
      "issuer_id, cik, company_name, city, state, target_raise, amount_sold, filing_date, ACCESSIONNUMBER, industry, submission_type",
      { count: "estimated" },
    );

  // 3. Stack the Boolean Filters
  if (nameSearch) query = query.ilike("company_name", `%${nameSearch}%`);
  if (cik) query = query.eq("cik", parseInt(cik, 10));
  if (city) query = query.ilike("city", `%${city}%`);
  if (stateCode) query = query.ilike("state", stateCode);
  if (industry) query = query.eq("industry", industry);
  if (entityType) query = query.eq("entity_type", entityType);
  if (fundType === "NONE") query = query.is("investment_fund_type", null);
  else if (fundType) query = query.eq("investment_fund_type", fundType);
  if (submissionType) query = query.eq("submission_type", submissionType);

  // Numeric ranges run against the numeric-safe columns added in migration
  // 0004 — target_raise/amount_sold/min_investment can't be trusted for
  // comparisons directly (target_raise is text and holds "Indefinite").
  if (!isNaN(minRaise)) query = query.gte("target_raise_numeric", minRaise);
  if (!isNaN(maxRaise)) query = query.lte("target_raise_numeric", maxRaise);
  if (offeringType === "fixed")
    query = query.eq("is_indefinite_offering", false);
  else if (offeringType === "indefinite")
    query = query.eq("is_indefinite_offering", true);

  if (!isNaN(minSold)) query = query.gte("amount_sold", minSold);
  if (!isNaN(maxSold)) query = query.lte("amount_sold", maxSold);

  if (!isNaN(minCheck)) query = query.gte("min_investment", minCheck);
  if (!isNaN(maxCheck)) query = query.lte("min_investment", maxCheck);

  if (revenueRange) query = query.eq("revenue_range", revenueRange);
  if (exemption) query = query.ilike("federal_exemptions", `%${exemption}%`);
  if (accredited)
    query = query.eq("has_non_accredited_investors", accredited === "true");
  if (phoneOnly) query = query.not("issuer_phone", "is", null);

  if (dateFrom) query = query.gte("filing_date_parsed", dateFrom);
  if (dateTo) query = query.lte("filing_date_parsed", dateTo);

  // 4. Sort — filing_date is stored as text ("DD-MON-YYYY"), so ordering by
  // it directly sorts alphabetically, not chronologically. Use the
  // migration's parsed/numeric columns instead.
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    date_desc: { column: "filing_date_parsed", ascending: false },
    date_asc: { column: "filing_date_parsed", ascending: true },
    raise_desc: { column: "target_raise_numeric", ascending: false },
    sold_desc: { column: "amount_sold", ascending: false },
    name_asc: { column: "company_name", ascending: true },
  };
  const { column: sortColumn, ascending: sortAscending } =
    sortMap[sort] || sortMap.date_desc;

  // 4. Execute the Query
  const {
    data: profiles,
    count,
    error,
  } = await query
    .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
    .range(from, to);

  if (error) {
    return (
      <div className="p-4 m-4 border-2 border-black bg-red-500 text-white font-bold uppercase">
        System Error: {error.message}
      </div>
    );
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;

  // Preserve filters when paginating
  const filterParams = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = resolvedParams[key];
    if (value) filterParams.set(key, value);
  }
  const baseQueryString = filterParams.toString()
    ? `&${filterParams.toString()}`
    : "";

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black">
      <header className="mb-6 border-b-4 border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">
            Intelligence Dashboard
          </h1>
          <p className="text-base font-bold mt-1 text-white">
            Mark Zuckerberg's Computer
          </p>
        </div>
        <div className="text-sm font-bold bg-[#10B981] px-4 py-2 border-2 border-black uppercase tracking-wide">
          Results: {count || 0}
        </div>
      </header>

      {/* Insert the Filter Control Panel here */}
      <FilterForm />

      <div className="overflow-x-auto border-2 border-black bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#10B981] border-b-2 border-black text-black font-black uppercase tracking-tight">
              <th className="p-3 border-r-2 border-black">Company Name</th>
              <th className="p-3 border-r-2 border-black">CIK</th>
              <th className="p-3 border-r-2 border-black">Location</th>
              <th className="p-3 border-r-2 border-black text-right">
                Target Raise
              </th>
              <th className="p-3 border-r-2 border-black text-right">
                Amount Sold
              </th>
              <th className="p-3 border-r-2 border-black text-right">
                Filing Date
              </th>
              <th className="p-3 text-center">EDGAR</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black font-bold">
            {profiles && profiles.length > 0 ? (
              profiles.map((company) => {
                const { indexUrl, xmlUrl } = getSecUrls(
                  company.cik,
                  company.ACCESSIONNUMBER,
                );

                return (
                  <tr
                    key={company.issuer_id}
                    className="hover:bg-[#10B981]/20 transition-none"
                  >
                    <td className="p-3 border-r-2 border-black font-bold text-zinc-900 hover:underline">
                      <Link href={`/company/${company.ACCESSIONNUMBER}`}>
                        {company.company_name || "Unknown"}
                      </Link>
                    </td>
                    <td className="p-3 border-r-2 border-black font-mono text-xs">
                      {company.cik || "N/A"}
                    </td>
                    <td className="p-3 border-r-2 border-black text-zinc-700 uppercase">
                      {company.city && company.state
                        ? `${company.city}, ${company.state}`
                        : "N/A"}
                    </td>
                    <td className="p-3 border-r-2 border-black text-right font-mono">
                      ${Number(company.target_raise || 0).toLocaleString()}
                    </td>
                    <td className="p-3 border-r-2 border-black text-right font-mono">
                      ${Number(company.amount_sold || 0).toLocaleString()}
                    </td>
                    <td className="p-3 border-r-2 border-black text-right text-zinc-600">
                      {company.filing_date || "N/A"}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-2 justify-center text-xs">
                        <a
                          href={indexUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 border-2 border-black bg-white hover:bg-black hover:text-white uppercase tracking-tight"
                        >
                          Form
                        </a>
                        <a
                          href={xmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 border-2 border-black bg-zinc-200 hover:bg-black hover:text-white uppercase tracking-tight"
                        >
                          XML
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center font-black uppercase text-xl text-zinc-400"
                >
                  No matches found for your filter constraints.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-6 text-base font-black uppercase tracking-wide">
        <div>
          Showing {from + 1} - {Math.min(to + 1, count || 0)}
        </div>
        <div className="flex gap-4">
          <Link
            href={`?page=${currentPage - 1}${baseQueryString}`}
            className={`px-6 py-2 border-2 border-black text-black ${
              currentPage <= 1
                ? "pointer-events-none bg-zinc-200 text-zinc-400"
                : "bg-white hover:bg-[#10B981]"
            }`}
          >
            Prev
          </Link>
          <Link
            href={`?page=${currentPage + 1}${baseQueryString}`}
            className={`px-6 py-2 border-2 border-black text-black ${
              currentPage >= totalPages
                ? "pointer-events-none bg-zinc-200 text-zinc-400"
                : "bg-white hover:bg-[#10B981]"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
