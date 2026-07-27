import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import FilterForm from "./components/FilterForm"; // Import our new Client Component
import NewestLeads from "./components/NewestLeads";
import ExportDetailedButton from "./components/ExportDetailedButton";
import {
  FILTER_KEYS,
  buildFundraisingQuery,
  getFundraisingSort,
} from "@/lib/fundraisingSearch";

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

// SEC Form D allows an offering to be uncapped — target_raise comes back as
// the literal string "Indefinite" rather than a number in that case, which
// Number() turns into NaN.
function formatOfferingAmount(value: string | number | null | undefined) {
  if (value === "Indefinite") return "Indefinite";
  return `$${Number(value || 0).toLocaleString()}`;
}

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
  const sort = resolvedParams.sort || "date_desc";

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // 2. Build the Supabase Query Dynamically (shared with the CSV export route
  // so downloaded results always match what's on screen)
  const query = buildFundraisingQuery(
    supabase,
    "issuer_id, cik, company_name, city, state, target_raise, amount_sold, filing_date, ACCESSIONNUMBER, industry, submission_type",
    resolvedParams,
    { count: "estimated" },
  );

  // Sort — filing_date is stored as text ("DD-MON-YYYY"), so ordering by it
  // directly sorts alphabetically, not chronologically. Use the migration's
  // parsed/numeric columns instead.
  const { column: sortColumn, ascending: sortAscending } =
    getFundraisingSort(sort);

  // 4. Execute the Query
  const {
    data: profiles,
    count,
    error,
  } = await query
    .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
    // issuer_id tiebreaker: without a deterministic secondary sort, rows
    // tied on sortColumn can come back in a different order between page
    // requests, silently skipping or duplicating rows under .range().
    .order("issuer_id", { ascending: sortAscending })
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

  // Only offer exports once the user has actually narrowed the data down —
  // "sort" alone doesn't reduce the result set, so it doesn't count as a
  // filter here. Without this, the buttons would let someone one-click
  // export the entire unfiltered table.
  const hasActiveFilters = FILTER_KEYS.some(
    (key) => key !== "sort" && resolvedParams[key],
  );

  return (
    <div className="max-w-7xl mx-auto p-4 font-sans text-black">
      <header className="mb-6 border-b-4 border-white pb-4">
        <h1 className="text-3xl font-black tracking-tight uppercase text-white">
          Intelligence Dashboard
        </h1>
        <p className="text-base font-bold mt-1 text-white">
          Mark Zuckerberg's Computer
        </p>
      </header>

      <NewestLeads />

      {/* Insert the Filter Control Panel here */}
      <FilterForm />

      <div className="flex justify-between items-center mb-4">
        {hasActiveFilters ? (
          <div className="flex gap-2">
            <ExportDetailedButton filterParams={filterParams.toString()} />
          </div>
        ) : (
          <div />
        )}
        <div className="text-sm font-bold bg-[#2596BE] text-white px-4 py-2 border-2 border-black uppercase tracking-wide">
          Results: {count || 0}
        </div>
      </div>

      <div className="overflow-x-auto border-2 border-black bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#2596BE] border-b-2 border-black text-white font-black uppercase tracking-tight">
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
                    className="hover:bg-[#2596BE]/20 transition-none"
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
                      {formatOfferingAmount(company.target_raise)}
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
        <div className="text-white">
          Showing {from + 1} - {Math.min(to + 1, count || 0)}
        </div>
        <div className="flex gap-4">
          <Link
            href={`?page=${currentPage - 1}${baseQueryString}`}
            className={`px-6 py-2 border-2 border-black text-black ${
              currentPage <= 1
                ? "pointer-events-none bg-zinc-200 text-zinc-400"
                : "bg-white hover:bg-[#2596BE]"
            }`}
          >
            Prev
          </Link>
          <Link
            href={`?page=${currentPage + 1}${baseQueryString}`}
            className={`px-6 py-2 border-2 border-black text-black ${
              currentPage >= totalPages
                ? "pointer-events-none bg-zinc-200 text-zinc-400"
                : "bg-white hover:bg-[#2596BE]"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
