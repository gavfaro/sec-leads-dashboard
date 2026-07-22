"use client";

import { useState } from "react";
import Link from "next/link";
import { Overlay, ModalHeader } from "./PartnerModal";

export interface PortfolioCompany {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  stage: string | null;
}

function websiteHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function CompanyDetailModal({
  company,
  onClose,
}: {
  company: PortfolioCompany;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <ModalHeader title={company.name} onClose={onClose} />
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">{company.name}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {company.stage && (
              <span className="text-[9px] font-black uppercase tracking-wider border border-zinc-300 px-2 py-0.5 bg-zinc-100 text-zinc-600">
                {company.stage}
              </span>
            )}
            {company.website && (
              <a
                href={websiteHref(company.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#2596BE] hover:underline"
              >
                {company.website.replace(/^https?:\/\//, "")} ↗
              </a>
            )}
          </div>
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

export default function PortfolioSection({
  companies,
  page,
  totalPages,
  totalCount,
  orgId,
}: {
  companies: PortfolioCompany[];
  page: number;
  totalPages: number;
  totalCount: number;
  orgId: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PortfolioCompany | null>(null);

  const filtered = search.trim()
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : companies;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-t-4 border-black pt-6">
        <h2 className="font-black uppercase text-xl tracking-tight">
          Portfolio Companies
          <span className="ml-2 font-mono text-sm text-zinc-500 bg-zinc-100 border border-zinc-300 px-2 py-0.5 align-middle">
            {totalCount}
          </span>
        </h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter on this page…"
          className="border-2 border-black px-3 py-1.5 text-xs font-mono w-52 placeholder:text-zinc-400 focus:outline-none focus:border-[#2596BE]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs font-bold uppercase text-zinc-400 tracking-wide py-8 text-center border-2 border-zinc-200">
          No companies match.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((co) => (
            <div key={co.id} className="border-2 border-black bg-white flex flex-col p-3 gap-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => setSelected(co)}
                  className="text-sm font-black uppercase tracking-tight text-left hover:text-[#2596BE] leading-tight flex-1 min-w-0"
                >
                  {co.name}
                </button>
                {co.website && (
                  <a
                    href={websiteHref(co.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-zinc-400 hover:text-[#2596BE] text-sm leading-none"
                    aria-label={`Visit ${co.name}`}
                  >
                    ↗
                  </a>
                )}
              </div>
              {co.stage && (
                <span className="self-start text-[9px] font-black uppercase tracking-wider border border-zinc-300 px-1.5 py-0.5 bg-zinc-50 text-zinc-500">
                  {co.stage}
                </span>
              )}
              {co.description && (
                <p className="text-[10px] text-zinc-600 leading-relaxed line-clamp-2 font-sans">
                  {co.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && !search.trim() && (
        <div className="flex items-center gap-4 mt-6">
          {page > 1 ? (
            <Link
              href={`/investors/${orgId}?p=${page - 1}`}
              className="px-4 py-2 border-2 border-black font-black text-xs uppercase tracking-wide bg-white hover:bg-[#2596BE] hover:text-white transition-none"
            >
              ← Prev
            </Link>
          ) : (
            <span className="px-4 py-2 border-2 border-zinc-200 font-black text-xs uppercase tracking-wide text-zinc-300">
              ← Prev
            </span>
          )}
          <span className="text-xs font-mono text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/investors/${orgId}?p=${page + 1}`}
              className="px-4 py-2 border-2 border-black font-black text-xs uppercase tracking-wide bg-white hover:bg-[#2596BE] hover:text-white transition-none"
            >
              Next →
            </Link>
          ) : (
            <span className="px-4 py-2 border-2 border-zinc-200 font-black text-xs uppercase tracking-wide text-zinc-300">
              Next →
            </span>
          )}
        </div>
      )}

      {selected && (
        <CompanyDetailModal company={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
