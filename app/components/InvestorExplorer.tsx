"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface OrgRow {
  id: string;
  name: string;
  website: string | null;
  typeName: string | null;
  partnerCount: number;
  companyCount: number;
}

interface PortfolioCompany {
  id: string;
  name: string;
  description: string | null;
}

export interface PartnerRow {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  linkedin_url: string | null;
  bio: string | null;
  orgId: string;
  orgName: string;
  investmentCount: number;
  currentCompanies: PortfolioCompany[];
  previousCompanies: PortfolioCompany[];
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function PartnerModal({
  partner,
  onClose,
}: {
  partner: PartnerRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-4 border-black bg-white mb-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b-2 border-black p-4 bg-zinc-100">
          <span className="font-black uppercase text-sm tracking-wide">
            {partner.firstName} {partner.lastName}
          </span>
          <button
            onClick={onClose}
            className="border-2 border-black px-3 py-1 font-black text-xs hover:bg-black hover:text-white transition-none"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name + LinkedIn + firm link */}
          <div className="flex justify-between items-start gap-4">
            <div>
              {partner.role && (
                <span className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100 inline-block mb-2">
                  {partner.role}
                </span>
              )}
              <h2 className="text-2xl font-black uppercase tracking-tight">
                {partner.firstName} {partner.lastName}
              </h2>
              <Link
                href={`/investors/${partner.orgId}`}
                className="text-xs font-bold uppercase text-zinc-500 hover:text-[#10B981] mt-0.5 inline-block"
              >
                {partner.orgName} ↗
              </Link>
            </div>
            {partner.linkedin_url && (
              <a
                href={partner.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-2 border-black bg-white hover:bg-[#10B981] font-bold text-xs uppercase tracking-wide transition-none"
              >
                <LinkedInIcon />
                LinkedIn
              </a>
            )}
          </div>

          {/* Bio */}
          {partner.bio && (
            <div className="border-l-4 border-[#10B981] pl-4">
              <p className="text-sm leading-relaxed text-zinc-700 font-sans">
                {partner.bio}
              </p>
            </div>
          )}

          {/* Current companies */}
          {partner.currentCompanies.length > 0 && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
                <span>Current Companies</span>
                <span className="font-mono bg-zinc-100 border border-zinc-300 px-1.5">
                  {partner.currentCompanies.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {partner.currentCompanies.map((co) => (
                  <span
                    key={co.id}
                    title={co.description ?? undefined}
                    className="text-[10px] font-bold border border-black px-2 py-0.5 bg-white"
                  >
                    {co.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enduring companies */}
          {partner.previousCompanies.length > 0 && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
                <span>Enduring Companies</span>
                <span className="font-mono bg-zinc-100 border border-zinc-300 px-1.5">
                  {partner.previousCompanies.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {partner.previousCompanies.map((co) => (
                  <span
                    key={co.id}
                    title={co.description ?? undefined}
                    className="text-[10px] font-bold border border-zinc-300 px-2 py-0.5 bg-zinc-50 text-zinc-500"
                  >
                    {co.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvestorExplorer({
  orgs,
  partners,
}: {
  orgs: OrgRow[];
  partners: PartnerRow[];
}) {
  const [view, setView] = useState<"firms" | "partners">("firms");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<PartnerRow | null>(null);

  const q = search.toLowerCase().trim();

  const filteredOrgs = useMemo(
    () => (q ? orgs.filter((o) => o.name.toLowerCase().includes(q)) : orgs),
    [orgs, q],
  );

  const filteredPartners = useMemo(
    () =>
      partners.filter((p) => {
        const matchesSearch =
          !q ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.orgName.toLowerCase().includes(q) ||
          (p.role ?? "").toLowerCase().includes(q);
        const matchesRole = !roleFilter || p.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [partners, q, roleFilter],
  );

  const roles = useMemo(
    () =>
      [...new Set(partners.map((p) => p.role).filter(Boolean))] as string[],
    [partners],
  );

  return (
    <>
      {/* Search + view toggle */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            view === "firms"
              ? "Search firms…"
              : "Search by partner name, firm, or role…"
          }
          className="border-2 border-black p-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#10B981] flex-1 min-w-48"
        />

        {view === "partners" && roles.length > 0 && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border-2 border-black p-2 font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#10B981]"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        <div className="flex border-2 border-black">
          {(["firms", "partners"] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                "px-4 py-2 text-xs font-black uppercase tracking-wider transition-none",
                i > 0 && "border-l-2 border-black",
                view === v
                  ? "bg-[#10B981] text-black"
                  : "bg-white text-black hover:bg-zinc-100",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Firms grid ── */}
      {view === "firms" &&
        (filteredOrgs.length === 0 ? (
          <div className="border-2 border-black p-12 text-center font-black uppercase text-zinc-400">
            No firms match &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrgs.map((org) => (
              <Link
                key={org.id}
                href={`/investors/${org.id}`}
                className="block border-2 border-black bg-white p-5 hover:border-[#10B981] hover:bg-[#10B981]/5 transition-none group"
              >
                <div className="flex items-start justify-between gap-2 mb-3 min-h-[24px]">
                  {org.typeName && (
                    <span className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100 whitespace-nowrap">
                      {org.typeName}
                    </span>
                  )}
                  {org.website && (
                    <span className="text-[10px] font-mono text-zinc-400 truncate">
                      {org.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight mb-4 group-hover:text-[#10B981]">
                  {org.name}
                </h2>
                <div className="flex gap-6 border-t-2 border-black pt-3 font-mono">
                  <div>
                    <span className="text-2xl font-black tabular-nums leading-none">
                      {org.partnerCount}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block mt-0.5">
                      Partners
                    </span>
                  </div>
                  <div className="border-l-2 border-black pl-6">
                    <span className="text-2xl font-black tabular-nums leading-none">
                      {org.companyCount}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block mt-0.5">
                      Companies
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}

      {/* ── Partners table ── */}
      {view === "partners" && (
        <div className="overflow-x-auto border-2 border-black bg-white">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#10B981] border-b-2 border-black font-black uppercase tracking-tight text-[10px]">
                <th className="p-3 border-r-2 border-black">Partner</th>
                <th className="p-3 border-r-2 border-black">Firm</th>
                <th className="p-3 border-r-2 border-black">Role</th>
                <th className="p-3 border-r-2 border-black text-right">
                  Companies
                </th>
                <th className="p-3 text-center">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {filteredPartners.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center font-black uppercase text-zinc-400"
                  >
                    No partners match your search.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-none">
                    <td className="p-3 border-r-2 border-black">
                      <button
                        onClick={() => setSelectedPartner(p)}
                        className="font-black uppercase text-xs tracking-tight hover:text-[#10B981] hover:underline text-left"
                      >
                        {p.firstName} {p.lastName}
                      </button>
                    </td>
                    <td className="p-3 border-r-2 border-black">
                      <Link
                        href={`/investors/${p.orgId}`}
                        className="font-bold text-xs uppercase text-zinc-600 hover:text-[#10B981] transition-none"
                      >
                        {p.orgName}
                      </Link>
                    </td>
                    <td className="p-3 border-r-2 border-black">
                      {p.role && (
                        <span className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100">
                          {p.role}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-r-2 border-black text-right font-mono font-black tabular-nums">
                      {p.investmentCount}
                    </td>
                    <td className="p-3 text-center">
                      {p.linkedin_url ? (
                        <a
                          href={p.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1.5 border-2 border-black bg-white hover:bg-[#10B981] hover:text-white transition-none"
                          aria-label={`${p.firstName} ${p.lastName} on LinkedIn`}
                        >
                          <LinkedInIcon />
                        </a>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="border-t-2 border-black p-3 bg-zinc-50 text-xs font-black uppercase tracking-wide text-zinc-500">
            Showing {filteredPartners.length} of {partners.length} partners
          </div>
        </div>
      )}

      {/* Partner profile modal */}
      {selectedPartner && (
        <PartnerModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
        />
      )}
    </>
  );
}
