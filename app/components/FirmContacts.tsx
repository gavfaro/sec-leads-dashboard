"use client";

import { useState } from "react";
import {
  Company,
  ContactWithInvestments,
  LinkedInIcon,
  PartnerModal,
  CompanyModal,
  oneCompany,
} from "./PartnerModal";

export type { ContactWithInvestments };

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
                      className="block text-left text-base font-black uppercase tracking-tight leading-tight hover:text-[#2596BE] transition-none"
                    >
                      {contact.first_name} {contact.last_name}
                    </button>
                  </div>
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1.5 border-2 border-black bg-white hover:bg-[#2596BE] hover:text-white transition-none"
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
                          className="text-[10px] font-bold border border-black px-2 py-0.5 bg-white hover:bg-[#2596BE]/20 transition-none"
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
