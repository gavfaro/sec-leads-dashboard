import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const NEWEST_COUNT = 6;

function timeAgo(isoDate: string) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function NewestLeads() {
  const { data: leads, error } = await supabase
    .from("newest_lead_profiles")
    .select(
      "ACCESSIONNUMBER, company_name, cik, city, state, industry, target_raise, discovered_at, website_url, ceo_name, ceo_linkedin",
    )
    .order("discovered_at", { ascending: false })
    .limit(NEWEST_COUNT);

  if (error || !leads || leads.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-black uppercase tracking-tight">
          🆕 Newest Additions
        </h2>
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          Auto-discovered by the daily SEC scan
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead) => (
          <Link
            key={lead.ACCESSIONNUMBER}
            href={`/company/${lead.ACCESSIONNUMBER}`}
            className="block border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <div className="flex justify-between items-start gap-2">
              <span className="text-[10px] font-black uppercase bg-[#10B981] px-1.5 py-0.5 border border-black">
                {lead.industry || "General"}
              </span>
              <span className="text-[10px] font-bold uppercase text-zinc-500 shrink-0">
                {timeAgo(lead.discovered_at)}
              </span>
            </div>

            <h3 className="font-black uppercase text-sm mt-2 leading-tight">
              {lead.company_name || "Unknown"}
            </h3>

            <p className="text-xs font-bold text-zinc-600 uppercase mt-1">
              {lead.city && lead.state ? `${lead.city}, ${lead.state}` : "N/A"}
            </p>

            <p className="text-xs font-mono mt-2">
              Target: ${Number(lead.target_raise || 0).toLocaleString()}
            </p>

            {lead.ceo_name && (
              <p className="text-xs font-bold mt-2 truncate">
                CEO: {lead.ceo_name}
                {lead.ceo_linkedin && lead.ceo_linkedin !== "Not Found" && (
                  <span className="text-[#10B981]"> · LinkedIn ✓</span>
                )}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
