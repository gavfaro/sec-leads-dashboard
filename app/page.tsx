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
    minRaise?: string;
    state?: string;
    industry?: string;
    type?: string;
    name?: string;
  }>;
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
  const minRaise = parseInt(resolvedParams.minRaise || "0", 10);
  const stateCode = resolvedParams.state || "";
  const industry = resolvedParams.industry || "";
  const submissionType = resolvedParams.type || "";
  const nameSearch = resolvedParams.name || "";

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
  if (minRaise > 0) query = query.gte("target_raise", minRaise);
  if (stateCode) query = query.ilike("state", stateCode);
  // Trailing wildcard only — leading % disables index usage and causes full table scans
  if (industry) query = query.ilike("industry", `${industry}%`);
  if (submissionType) query = query.eq("submission_type", submissionType);

  // 4. Execute the Query
  const {
    data: profiles,
    count,
    error,
  } = await query.order("filing_date", { ascending: false }).range(from, to);

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
  if (resolvedParams.name) filterParams.set("name", resolvedParams.name);
  if (resolvedParams.minRaise)
    filterParams.set("minRaise", resolvedParams.minRaise);
  if (resolvedParams.state) filterParams.set("state", resolvedParams.state);
  if (resolvedParams.industry)
    filterParams.set("industry", resolvedParams.industry);
  if (resolvedParams.type) filterParams.set("type", resolvedParams.type);
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
