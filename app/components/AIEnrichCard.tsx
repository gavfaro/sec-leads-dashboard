"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AiEnrichCard({
  cik,
  accessionNumber,
  companyName,
  address,
  signer,
  executives,
  relatedPersons,
  industry,
  dateOfFirstSale,
  targetRaise,
  amountSold,
  existingProfile,
}: any) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const runAiEngine = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cik,
          accessionNumber,
          companyName,
          address,
          signer,
          executives,
          relatedPersons,
          industry,
          dateOfFirstSale,
          targetRaise,
          amountSold,
        }),
      });
      if (res.ok) {
        // Refresh the page data to show the newly saved Supabase profile
        router.refresh();
      } else {
        alert("AI Enrichment failed. Check console.");
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (existingProfile) {
    return (
      <section className="border-4 border-black bg-[#10B981] mb-12 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="bg-black text-white p-2 border-b-4 border-black font-black uppercase text-sm tracking-wide">
          🤖 AI Intelligence Profile
        </div>
        <div className="p-6 bg-white space-y-4">
          <div>
            <span className="font-black uppercase text-[10px] text-zinc-500 block">
              Website Detected
            </span>
            <a
              href={existingProfile.website_url}
              target="_blank"
              className="font-mono text-sm underline font-bold"
            >
              {existingProfile.website_url}
            </a>
          </div>
          <div>
            <span className="font-black uppercase text-[10px] text-zinc-500 block">
              AI Executive Target (Claude Haiku)
            </span>
            <span className="font-bold text-sm block uppercase">
              {existingProfile.ceo_name}
            </span>
            {existingProfile.ceo_linkedin !== "Not Found" && (
              <a
                href={existingProfile.ceo_linkedin}
                target="_blank"
                className="font-mono text-xs underline bg-[#10B981] px-1 border border-black"
              >
                LinkedIn Profile
              </a>
            )}
          </div>
          <div className="border-t-2 border-black pt-4 mt-4">
            <span className="font-black uppercase text-[10px] text-zinc-500 block mb-2">
              Gemini 2.5 Flash Summary
            </span>
            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed font-medium bg-zinc-50 p-4 border-2 border-black">
              {existingProfile.ai_summary}
            </div>
          </div>
          {(existingProfile.round_stage ||
            existingProfile.round_amount ||
            existingProfile.round_summary) && (
            <div className="border-t-2 border-black pt-4 mt-4">
              <span className="font-black uppercase text-[10px] text-zinc-500 block mb-2">
                Funding Round Signal (Claude Web Search)
              </span>
              <div className="flex flex-wrap gap-2 mb-2">
                {existingProfile.round_stage && (
                  <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                    {existingProfile.round_stage}
                  </span>
                )}
                {existingProfile.round_amount && (
                  <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                    {existingProfile.round_amount}
                  </span>
                )}
                {existingProfile.round_date && (
                  <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                    {existingProfile.round_date}
                  </span>
                )}
              </div>
              {existingProfile.round_summary && (
                <p className="font-mono text-xs leading-relaxed font-medium bg-zinc-50 p-4 border-2 border-black">
                  {existingProfile.round_summary}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="border-4 border-black bg-white mb-12 flex flex-col items-center justify-center p-8 text-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNlN2U1ZTQiLz48L3N2Zz4=')]">
      <h3 className="font-black uppercase text-xl mb-2 bg-white px-2">
        Data Enrichment Required
      </h3>
      <p className="font-bold text-sm text-zinc-600 mb-6 bg-white px-2 max-w-md">
        No AI profile exists for this CIK. Run the agentic workflow to search
        Clearbit, scrape the web with Gemini, and locate the CEO via Claude.
      </p>
      <button
        onClick={runAiEngine}
        disabled={loading}
        className="bg-[#10B981] border-4 border-black text-black font-black uppercase px-8 py-3 hover:bg-emerald-400 transition-none disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
      >
        {loading ? "Executing AI Pipeline..." : "▶ Run AI Intelligence Profile"}
      </button>
    </section>
  );
}
