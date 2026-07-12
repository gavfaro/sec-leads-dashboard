"use client";

import { useState } from "react";

interface Company {
  id: string;
  name: string;
  description: string | null;
}

interface ContactInvestment {
  relationship: string;
  companies: Company | Company[] | null;
}

function oneCompany(c: Company | Company[] | null): Company | null {
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

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
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

function CompanyModal({
  company,
  relationship,
  onClose,
}: {
  company: Company;
  relationship: string;
  onClose: () => void;
}) {
  const isCurrent = relationship === "current";
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
                ? "bg-[#10B981]/20 border-[#10B981]"
                : "bg-zinc-100 border-zinc-300 text-zinc-500",
            ].join(" ")}
          >
            {isCurrent ? "Active Investment" : "Enduring / Exited"}
          </span>
        </div>
        {company.description ? (
          <p className="text-sm leading-relaxed text-zinc-700 font-sans border-l-4 border-[#10B981] pl-4">
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

function PartnerModal({
  partner,
  onClose,
}: {
  partner: ContactWithInvestments;
  onClose: () => void;
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
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-2 border-black bg-white hover:bg-[#10B981] font-bold text-xs uppercase tracking-wide transition-none"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          )}
        </div>

        {/* Full bio */}
        {partner.bio && (
          <div className="border-l-4 border-[#10B981] pl-4">
            <p className="text-sm leading-relaxed text-zinc-700 font-sans">{partner.bio}</p>
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
    </Overlay>
  );
}

const ROLE_ORDER: Record<string, number> = {
  "Seed/Early Investor": 0,
  "Growth Investor": 1,
  Operator: 2,
};

export default function FirmContacts({
  contacts,
}: {
  contacts: ContactWithInvestments[];
}) {
  const [selectedPartner, setSelectedPartner] =
    useState<ContactWithInvestments | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<{
    company: Company;
    relationship: string;
  } | null>(null);

  const sorted = [...contacts].sort(
    (a, b) =>
      (ROLE_ORDER[a.role ?? ""] ?? 99) - (ROLE_ORDER[b.role ?? ""] ?? 99) ||
      a.last_name.localeCompare(b.last_name),
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((contact) => {
          const investments = contact.contact_investments ?? [];
          const current = investments
            .filter((ci) => ci.relationship === "current")
            .map((ci) => oneCompany(ci.companies))
            .filter(Boolean) as Company[];
          const previous = investments
            .filter((ci) => ci.relationship === "previous")
            .map((ci) => oneCompany(ci.companies))
            .filter(Boolean) as Company[];

          return (
            <div key={contact.id} className="border-2 border-black bg-white flex flex-col">
              {/* Card header */}
              <div className="p-4 border-b-2 border-black">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {contact.role && (
                      <span className="text-[9px] font-black uppercase tracking-wider border border-black px-2 py-0.5 bg-zinc-100 inline-block mb-2">
                        {contact.role}
                      </span>
                    )}
                    <button
                      onClick={() => setSelectedPartner(contact)}
                      className="block text-left text-base font-black uppercase tracking-tight leading-tight hover:text-[#10B981] transition-none"
                    >
                      {contact.first_name} {contact.last_name}
                    </button>
                  </div>
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1.5 border-2 border-black bg-white hover:bg-[#10B981] hover:text-white transition-none"
                      aria-label="LinkedIn profile"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                </div>

                {contact.bio && (
                  <p className="text-xs text-zinc-600 mt-2 leading-relaxed line-clamp-3 font-sans">
                    {contact.bio}
                  </p>
                )}
              </div>

              {/* Companies */}
              <div className="p-4 flex-1 space-y-3">
                {current.length > 0 && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
                      Current · {current.length}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {current.map((co) => (
                        <button
                          key={co.id}
                          onClick={() =>
                            setSelectedCompany({ company: co, relationship: "current" })
                          }
                          className="text-[10px] font-bold border border-black px-2 py-0.5 bg-white hover:bg-[#10B981]/20 transition-none"
                        >
                          {co.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {previous.length > 0 && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
                      Enduring · {previous.length}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {previous.map((co) => (
                        <button
                          key={co.id}
                          onClick={() =>
                            setSelectedCompany({ company: co, relationship: "previous" })
                          }
                          className="text-[10px] font-bold border border-zinc-300 px-2 py-0.5 bg-zinc-50 text-zinc-500 hover:bg-zinc-200 transition-none"
                        >
                          {co.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {current.length === 0 && previous.length === 0 && (
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    No portfolio data
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPartner && (
        <PartnerModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
        />
      )}
      {selectedCompany && (
        <CompanyModal
          company={selectedCompany.company}
          relationship={selectedCompany.relationship}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </>
  );
}
