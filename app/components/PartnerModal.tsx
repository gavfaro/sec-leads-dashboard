"use client";

import { useEffect, useState } from "react";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website?: string | null;
}

export interface ContactInvestment {
  relationship: string;
  companies: Company | Company[] | null;
}

export function oneCompany(c: Company | Company[] | null): Company | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

export interface ContactWithInvestments {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  linkedin_url: string | null;
  bio: string | null;
  contact_investments: ContactInvestment[];
}

export interface SimilarCompany {
  companyId: string;
  companyName: string;
  description: string | null;
  website: string | null;
  score: number;
}

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-4 border-black bg-white mb-16"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-black p-4 bg-zinc-100">
      <span className="font-black uppercase text-sm tracking-wide">{title}</span>
      <button
        onClick={onClose}
        className="border-2 border-black px-3 py-1 font-black text-xs hover:bg-black hover:text-white transition-none"
      >
        ✕ Close
      </button>
    </div>
  );
}

interface InferredVertical {
  tag: string;
  score: number;
}

// Module-level, not component state: a company's inferred verticals don't
// change within a session, so once fetched they're reused for the rest of the
// page's lifetime instead of re-fetching (and re-showing a loading flash) every
// time the same company's popup is reopened. Cleared naturally on page reload.
const verticalsCache = new Map<string, InferredVertical[]>();

export function CompanyModal({
  company,
  relationship,
  onClose,
}: {
  company: Company;
  relationship: string;
  onClose: () => void;
}) {
  const isCurrent = relationship === "current";
  const cached = verticalsCache.get(company.id);
  const [verticals, setVerticals] = useState<InferredVertical[]>(cached ?? []);
  const [loadingVerticals, setLoadingVerticals] = useState(cached === undefined);

  // Companies have no structured vertical tags in the DB -- these are inferred
  // from the company's cached description embedding (nearest cached vertical
  // tags) via a quick lookup, not a live embedding call -- but still a network
  // round trip, so skip it entirely once cached for this company.
  useEffect(() => {
    const alreadyCached = verticalsCache.get(company.id);
    if (alreadyCached) {
      setVerticals(alreadyCached);
      setLoadingVerticals(false);
      return;
    }

    let cancelled = false;
    setLoadingVerticals(true);
    fetch(`/api/company-verticals?companyId=${encodeURIComponent(company.id)}`)
      .then((res) => res.json())
      .then((data) => {
        const result: InferredVertical[] = data.verticals ?? [];
        verticalsCache.set(company.id, result);
        if (!cancelled) setVerticals(result);
      })
      .catch(() => {
        if (!cancelled) setVerticals([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVerticals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  return (
    <Overlay onClose={onClose}>
      <ModalHeader title={company.name} onClose={onClose} />
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">{company.name}</h2>
          <span
            className={[
              "text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 inline-block mt-2",
              isCurrent
                ? "bg-[#2596BE]/20 border-[#2596BE]"
                : "bg-zinc-100 border-zinc-300 text-zinc-500",
            ].join(" ")}
          >
            {isCurrent ? "Active Investment" : "Enduring / Exited"}
          </span>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs font-bold text-[#2596BE] hover:underline mt-2"
            >
              {company.website}
            </a>
          )}
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
            Verticals
          </p>
          {loadingVerticals ? (
            <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">
              Loading…
            </p>
          ) : verticals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {verticals.map((v) => (
                <span
                  key={v.tag}
                  title={`Similarity ${v.score.toFixed(2)}`}
                  className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100"
                >
                  {v.tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
              No verticals inferred.
            </p>
          )}
        </div>

        {company.description ? (
          <p className="text-sm leading-relaxed text-zinc-700 font-sans border-l-4 border-[#2596BE] pl-4">
            {company.description}
          </p>
        ) : (
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            No description available.
          </p>
        )}
      </div>
    </Overlay>
  );
}

export function PartnerModal({
  partner,
  onClose,
  similarCompanies,
  bioSimilarity,
}: {
  partner: ContactWithInvestments;
  onClose: () => void;
  similarCompanies?: SimilarCompany[];
  bioSimilarity?: number | null;
}) {
  const investments = partner.contact_investments ?? [];
  const current = investments
    .filter((ci) => ci.relationship === "current")
    .map((ci) => oneCompany(ci.companies))
    .filter(Boolean) as Company[];
  const previous = investments
    .filter((ci) => ci.relationship === "previous")
    .map((ci) => oneCompany(ci.companies))
    .filter(Boolean) as Company[];

  const [selectedCompany, setSelectedCompany] = useState<{
    company: Company;
    relationship: string;
  } | null>(null);

  return (
    <Overlay onClose={onClose}>
      <ModalHeader
        title={`${partner.first_name} ${partner.last_name}`}
        onClose={onClose}
      />
      <div className="p-6 space-y-6">
        {/* Name + LinkedIn */}
        <div className="flex justify-between items-start gap-4">
          <div>
            {partner.role && (
              <span className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100 inline-block mb-2">
                {partner.role}
              </span>
            )}
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {partner.first_name} {partner.last_name}
            </h2>
          </div>
          {partner.linkedin_url && (
            <a
              href={partner.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-2 border-black bg-white hover:bg-[#2596BE] font-bold text-xs uppercase tracking-wide transition-none"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          )}
        </div>

        {/* Full bio */}
        {partner.bio && (
          <div className="border-l-4 border-[#2596BE] pl-4">
            {bioSimilarity != null && (
              <span className="text-[9px] font-black uppercase tracking-wider bg-[#2596BE]/20 border border-[#2596BE] px-2 py-0.5 inline-block mb-2">
                Bio Matches Startup · {bioSimilarity.toFixed(2)}
              </span>
            )}
            <p className="text-sm leading-relaxed text-zinc-700 font-sans">{partner.bio}</p>
          </div>
        )}

        {/* Similar companies -- from the active match run's startup description,
            not the contact's own data, so this section only appears when the
            modal is opened from the Matching Engine. */}
        {similarCompanies && similarCompanies.length > 0 && (
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
              <span>Similar Companies</span>
              <span className="font-mono bg-zinc-100 border border-zinc-300 px-1.5">
                {similarCompanies.length}
              </span>
            </div>
            <div className="border-2 border-black divide-y divide-zinc-200">
              {similarCompanies.map((sc) => (
                <button
                  key={sc.companyId}
                  onClick={() =>
                    setSelectedCompany({
                      company: { id: sc.companyId, name: sc.companyName, description: sc.description },
                      relationship: current.some((co) => co.id === sc.companyId) ? "current" : "previous",
                    })
                  }
                  className="w-full flex justify-between items-center px-3 py-1.5 gap-4 hover:bg-[#2596BE]/20 transition-none"
                >
                  <span className="font-bold uppercase text-xs tracking-tight truncate">
                    {sc.companyName}
                  </span>
                  <span className="font-mono font-black text-sm tabular-nums text-[#2596BE] flex-shrink-0">
                    {sc.score.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current companies */}
        {current.length > 0 && (
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
              <span>Current Companies</span>
              <span className="font-mono bg-zinc-100 border border-zinc-300 px-1.5">
                {current.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {current.map((co) => (
                <button
                  key={co.id}
                  onClick={() => setSelectedCompany({ company: co, relationship: "current" })}
                  className="text-[10px] font-bold border border-black px-2 py-0.5 bg-white hover:bg-[#2596BE]/20 transition-none"
                >
                  {co.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enduring companies */}
        {previous.length > 0 && (
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
              <span>Enduring Companies</span>
              <span className="font-mono bg-zinc-100 border border-zinc-300 px-1.5">
                {previous.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previous.map((co) => (
                <button
                  key={co.id}
                  onClick={() => setSelectedCompany({ company: co, relationship: "previous" })}
                  className="text-[10px] font-bold border border-zinc-300 px-2 py-0.5 bg-zinc-50 text-zinc-500 hover:bg-zinc-200 transition-none"
                >
                  {co.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCompany && (
        <CompanyModal
          company={selectedCompany.company}
          relationship={selectedCompany.relationship}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </Overlay>
  );
}
