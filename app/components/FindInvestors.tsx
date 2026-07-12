"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface InvestorEntry {
  contactId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  linkedin_url: string | null;
  orgId: string;
  orgName: string;
  relationship: string;
}

export interface CompanyEntry {
  id: string;
  name: string;
  description: string | null;
  investors: InvestorEntry[];
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function FindInvestors({ companies }: { companies: CompanyEntry[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q),
    );
  }, [companies, q]);

  // Deduplicate investors across all matching companies for the summary strip
  const topInvestors = useMemo(() => {
    if (matches.length === 0) return [];
    const seen = new Map<string, InvestorEntry & { matchCount: number }>();
    for (const co of matches) {
      for (const inv of co.investors) {
        const existing = seen.get(inv.contactId);
        if (existing) {
          existing.matchCount += 1;
        } else {
          seen.set(inv.contactId, { ...inv, matchCount: 1 });
        }
      }
    }
    return [...seen.values()].sort((a, b) => b.matchCount - a.matchCount);
  }, [matches]);

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="border-4 border-black p-6 bg-white">
        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
          Describe your company or sector
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. fintech, security, developer tools, healthcare AI…"
            autoFocus
            className="flex-1 border-2 border-black p-3 text-base font-sans focus:outline-none focus:ring-2 focus:ring-[#10B981]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="border-2 border-black px-4 font-black text-sm hover:bg-zinc-100 transition-none"
            >
              Clear
            </button>
          )}
        </div>
        {q && (
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-2">
            {matches.length === 0
              ? "No portfolio companies match that keyword."
              : `${matches.length} portfolio compan${matches.length === 1 ? "y" : "ies"} matched · ${topInvestors.length} investor${topInvestors.length === 1 ? "" : "s"} found`}
          </p>
        )}
      </div>

      {/* Empty / prompt state */}
      {!q && (
        <div className="border-2 border-black border-dashed p-16 text-center">
          <p className="font-black uppercase text-zinc-400 text-xl mb-2">
            Type a keyword above
          </p>
          <p className="text-sm font-bold text-zinc-400">
            We&apos;ll search across{" "}
            <span className="font-black text-black">{companies.length}</span>{" "}
            portfolio companies to find partners who invest in your space.
          </p>
        </div>
      )}

      {/* Investor summary strip */}
      {topInvestors.length > 0 && (
        <div>
          <h2 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">
            Relevant Investors · ranked by portfolio overlap
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {topInvestors.map((inv) => (
              <div
                key={inv.contactId}
                className="border-2 border-black bg-white p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {inv.role && (
                      <span className="text-[9px] font-black uppercase tracking-wider border border-black px-1.5 py-0.5 bg-zinc-100 inline-block mb-1">
                        {inv.role}
                      </span>
                    )}
                    <p className="font-black uppercase text-sm tracking-tight leading-tight">
                      {inv.firstName} {inv.lastName}
                    </p>
                    <Link
                      href={`/investors/${inv.orgId}`}
                      className="text-[10px] font-bold uppercase text-zinc-500 hover:text-[#10B981] transition-none"
                    >
                      {inv.orgName}
                    </Link>
                  </div>
                  {inv.linkedin_url && (
                    <a
                      href={inv.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1.5 border-2 border-black hover:bg-[#10B981] hover:text-white transition-none"
                      aria-label="LinkedIn"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                </div>
                <div className="border-t border-black pt-2 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    Portfolio Matches
                  </span>
                  <span className="font-mono font-black text-lg tabular-nums text-[#10B981]">
                    {inv.matchCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matching companies */}
      {matches.length > 0 && (
        <div>
          <h2 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-3">
            Matching Portfolio Companies
          </h2>
          <div className="border-2 border-black bg-white overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100 border-b-2 border-black font-black uppercase text-[10px] tracking-tight">
                  <th className="p-3 text-left border-r-2 border-black">Company</th>
                  <th className="p-3 text-left border-r-2 border-black">Description</th>
                  <th className="p-3 text-left">Investors</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-zinc-200">
                {matches.map((co) => (
                  <tr key={co.id} className="hover:bg-zinc-50 transition-none">
                    <td className="p-3 border-r-2 border-black font-black uppercase text-xs tracking-tight align-top whitespace-nowrap">
                      {co.name}
                    </td>
                    <td className="p-3 border-r-2 border-black text-xs text-zinc-600 font-sans align-top max-w-sm">
                      {co.description ? (
                        <HighlightedText text={co.description} query={q} />
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {co.investors.length === 0 ? (
                          <span className="text-zinc-300 text-xs">—</span>
                        ) : (
                          co.investors.map((inv) => (
                            <Link
                              key={inv.contactId}
                              href={`/investors/${inv.orgId}`}
                              className="text-[10px] font-bold border border-black px-2 py-0.5 bg-white hover:bg-[#10B981]/20 transition-none whitespace-nowrap"
                              title={`${inv.role ?? ""} · ${inv.orgName}`}
                            >
                              {inv.firstName} {inv.lastName}
                            </Link>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#10B981]/30 text-black not-italic font-bold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
