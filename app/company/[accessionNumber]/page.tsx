import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AiEnrichCard from "../../components/AIEnrichCard";
import ExportProfileButtons from "../../components/ExportProfileButtons";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProfileProps {
  params: Promise<{ accessionNumber: string }>;
}

// SEC Form D allows an offering to be uncapped — TOTALOFFERINGAMOUNT and
// TOTALREMAINING come back as the literal string "Indefinite" rather than a
// number in that case, which Number() turns into NaN.
function formatOfferingAmount(value: string | number | null | undefined) {
  if (value === "Indefinite") return "Indefinite";
  return `$${Number(value || 0).toLocaleString()}`;
}

export default async function CompanyProfile({ params }: ProfileProps) {
  const resolvedParams = await params;
  const { accessionNumber } = resolvedParams;

  // 1. Execute all primary queries in parallel for peak performance
  const [issuerRes, offeringRes, personsRes, submissionRes] = await Promise.all(
    [
      supabase
        .from("issuers")
        .select("*")
        .eq("ACCESSIONNUMBER", accessionNumber)
        .maybeSingle(),
      supabase
        .from("offering")
        .select("*")
        .eq("ACCESSIONNUMBER", accessionNumber)
        .maybeSingle(),
      supabase
        .from("related_persons")
        .select("*")
        .eq("ACCESSIONNUMBER", accessionNumber),
      supabase
        .from("submissions")
        .select("*")
        .eq("ACCESSIONNUMBER", accessionNumber)
        .maybeSingle(),
    ],
  );

  const issuer = issuerRes.data;
  const offering = offeringRes.data;
  const relatedPersons = personsRes.data || [];
  const submission = submissionRes.data;

  // Handle dead links or missing data
  if (!issuer) {
    return (
      <div className="max-w-4xl mx-auto p-6 mt-12 border-2 border-black bg-zinc-100 font-bold uppercase text-black">
        Filing Profile Not Found for Accession: {accessionNumber}
        <div className="mt-4">
          <Link href="/" className="underline text-[#2596BE]">
            ← Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // 2. Fetch filing history and AI profile using the permanent company CIK
  const [filingHistoryRes, aiProfileRes, discoveredInvestorsRes] = await Promise.all([
    supabase
      .from("company_fundraising_profiles")
      .select(
        "ACCESSIONNUMBER, filing_date, submission_type, target_raise, amount_sold",
      )
      .eq("cik", issuer.CIK)
      .order("filing_date_parsed", { ascending: false, nullsFirst: false }),
    supabase
      .from("ai_profiles")
      .select("*")
      .eq("cik", issuer.CIK)
      .maybeSingle(),
    supabase
      .from("discovered_investors")
      .select("*")
      .eq("cik", issuer.CIK),
  ]);

  const filingHistory = filingHistoryRes.data;
  const aiProfile = aiProfileRes.data;

  const CONFIDENCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const discoveredInvestors = (discoveredInvestorsRes.data || []).sort(
    (a: any, b: any) =>
      (CONFIDENCE_RANK[a.confidence] ?? 3) - (CONFIDENCE_RANK[b.confidence] ?? 3),
  );

  const exportData = {
    companyName: issuer.ENTITYNAME,
    accessionNumber,
    profileFields: [
      ["Entity Name", issuer.ENTITYNAME],
      ["Previous Name", issuer.ISSUER_PREVIOUSNAME_1],
      ["CIK", issuer.CIK],
      ["Accession Number", accessionNumber],
      ["Filing Date", submission?.FILING_DATE],
      ["Industry", offering?.INDUSTRYGROUPTYPE],
      ["Entity Type", issuer.ENTITYTYPE],
      ["Street Address", issuer.STREET1],
      ["Street Address 2", issuer.STREET2],
      ["City", issuer.CITY],
      ["State/Country", issuer.STATEORCOUNTRY],
      ["Zip Code", issuer.ZIPCODE],
      ["Phone Number", issuer.ISSUERPHONENUMBER],
      ["Jurisdiction of Incorporation", issuer.JURISDICTIONOFINC],
      ["Year of Incorporation", issuer.YEAROFINC_VALUE_ENTERED],
      ["SIC Code", submission?.SIC_CODE],
      ["Revenue Range", offering?.REVENUERANGE],
    ] as [string, string | number | null | undefined][],
    offeringFields: [
      ["Total Target Raise", formatOfferingAmount(offering?.TOTALOFFERINGAMOUNT)],
      ["Total Amount Sold", offering?.TOTALAMOUNTSOLD],
      ["Total Remaining", formatOfferingAmount(offering?.TOTALREMAINING)],
      ["Minimum Investment", offering?.MINIMUMINVESTMENTACCEPTED],
      ["Federal Exemption", offering?.FEDERALEXEMPTIONS_ITEMS_LIST],
      ["Total Investors", offering?.TOTALNUMBERALREADYINVESTED],
      ["Has Non-Accredited Investors", offering?.HASNONACCREDITEDINVESTORS ? "Yes" : "No"],
      ["Gross Proceeds Used", offering?.GROSSPROCEEDSUSED_DOLLARAMOUNT],
      ["Sales Commissions", offering?.SALESCOMM_DOLLARAMOUNT],
    ] as [string, string | number | null | undefined][],
    relatedPersonsRows: relatedPersons.map((p: any) => [
      `${p.FIRSTNAME} ${p.MIDDLENAME ? p.MIDDLENAME + " " : ""}${p.LASTNAME}`.trim(),
      [p.RELATIONSHIP_1, p.RELATIONSHIP_2, p.RELATIONSHIP_3]
        .filter(Boolean)
        .join("; "),
      p.CITY,
      p.STATEORCOUNTRY,
    ]),
    discoveredInvestorsRows: discoveredInvestors.map((inv: any) => [
      inv.investor_name,
      inv.investor_type,
      inv.role,
      inv.confidence,
      inv.discovery_method === "board_seat_hack" ? "Board Seat" : "Smart Search",
      inv.evidence,
      inv.source_url,
    ]),
    filingHistoryRows: (filingHistory || []).map((h: any) => [
      h.filing_date,
      h.submission_type === "D/A" ? "D/A (Amendment)" : "D (New Notice)",
      h.target_raise,
      h.amount_sold,
      h.ACCESSIONNUMBER,
    ]),
  };

  return (
    <div className="max-w-5xl mx-auto p-4 font-sans text-black pb-24">
      {/* Back Nav Header */}
      <nav className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-block px-4 py-2 border-2 border-black font-bold uppercase text-xs tracking-wider bg-white hover:bg-[#2596BE] transition-none"
        >
          ← Back to Lead Engine
        </Link>
        <ExportProfileButtons data={exportData} />
      </nav>

      {/* Profile Header Block */}
      <header className="mb-8 border-4 border-black p-6 bg-white shadow-none">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-black uppercase tracking-wider bg-[#2596BE] px-2 py-0.5 border border-black">
              {offering?.INDUSTRYGROUPTYPE || "General Technology"}
            </span>
            <h1 className="text-4xl font-black uppercase tracking-tight mt-2">
              {issuer.ENTITYNAME}
            </h1>
            {issuer.ISSUER_PREVIOUSNAME_1 && (
              <p className="text-sm font-bold text-zinc-600 mt-1 uppercase">
                FKA: {issuer.ISSUER_PREVIOUSNAME_1}
              </p>
            )}
          </div>
          <div className="text-right border-2 border-black p-2 bg-zinc-50">
            <span className="font-sans font-bold text-black uppercase block text-[10px]">
              Filing Date
            </span>
            <span className="font-mono font-black text-sm">
              {submission?.FILING_DATE || "N/A"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t-2 border-black font-mono text-sm">
          <div>
            <span className="font-sans font-bold text-black uppercase block text-[10px]">
              CIK Identifier
            </span>{" "}
            {issuer.CIK || "N/A"}
          </div>
          <div>
            <span className="font-sans font-bold text-black uppercase block text-[10px]">
              Accession Number
            </span>{" "}
            {accessionNumber}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* NEW: AI Agent Intelligence Card */}
        <AiEnrichCard
          cik={issuer.CIK}
          accessionNumber={accessionNumber}
          companyName={issuer.ENTITYNAME}
          address={`${issuer.STREET1}, ${issuer.CITY}, ${issuer.STATEORCOUNTRY}`}
          signer={submission?.FILING_DATE}
          executives={relatedPersons
            .map((p: any) => `${p.FIRSTNAME} ${p.LASTNAME}`)
            .join(", ")}
          relatedPersons={relatedPersons.map((p: any) => ({
            name: `${p.FIRSTNAME} ${p.LASTNAME}`.trim(),
            relationships: [
              p.RELATIONSHIP_1,
              p.RELATIONSHIP_2,
              p.RELATIONSHIP_3,
            ].filter(Boolean),
          }))}
          industry={offering?.INDUSTRYGROUPTYPE}
          dateOfFirstSale={offering?.SALE_DATE}
          targetRaise={offering?.TOTALOFFERINGAMOUNT}
          amountSold={offering?.TOTALAMOUNTSOLD}
          existingProfile={aiProfile}
        />

        {/* Section 1: Financial Deal Metrics */}
        <section className="border-2 border-black bg-white">
          <div className="bg-[#2596BE] p-2 border-b-2 border-black font-black uppercase text-sm tracking-wide">
            Offering & Capital Structure
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-left font-mono">
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Total Target Raise
              </span>
              <span className="text-lg font-black">
                {formatOfferingAmount(offering?.TOTALOFFERINGAMOUNT)}
              </span>
            </div>
            <div className="p-4 bg-[#2596BE]/20">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Total Amount Sold
              </span>
              <span className="text-lg font-black text-emerald-800">
                ${Number(offering?.TOTALAMOUNTSOLD || 0).toLocaleString()}
              </span>
            </div>
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Total Remaining
              </span>
              <span className="text-lg font-black">
                {formatOfferingAmount(offering?.TOTALREMAINING)}
              </span>
            </div>
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Min Investment
              </span>
              <span className="text-lg font-black">
                $
                {Number(
                  offering?.MINIMUMINVESTMENTACCEPTED || 0,
                ).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Sub-Section: Security Types */}
          <div className="border-t-2 border-black p-4 bg-zinc-50 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-tight items-center">
            <span className="text-black mr-2">Securities Offered:</span>
            {offering?.ISEQUITYTYPE === "true" && (
              <span className="border border-black px-2 py-0.5 bg-white">
                Equity
              </span>
            )}
            {offering?.ISDEBTTYPE === "true" && (
              <span className="border border-black px-2 py-0.5 bg-white">
                Debt
              </span>
            )}
            {offering?.ISOPTIONTOACQUIRETYPE === "true" && (
              <span className="border border-black px-2 py-0.5 bg-white">
                Options/Warrants
              </span>
            )}
            {offering?.ISPOOLEDINVESTMENTFUNDTYPE === "true" && (
              <span className="border border-black px-2 py-0.5 bg-[#2596BE]">
                Pooled Fund
              </span>
            )}
            {offering?.ISBUSINESSCOMBINATIONTRANS === "true" && (
              <span className="border border-black px-2 py-0.5 bg-black text-white">
                M&A Transaction
              </span>
            )}
          </div>
        </section>

        {/* Section 2: Investor Metrics & Use of Proceeds */}
        <section className="border-2 border-black bg-white">
          <div className="bg-zinc-100 p-2 border-b-2 border-black font-black uppercase text-xs tracking-wide flex justify-between">
            <span>Investor Metrics & Capital Allocation</span>
            <span>
              Exemption: {offering?.FEDERALEXEMPTIONS_ITEMS_LIST || "N/A"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-left font-mono">
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Total Investors
              </span>
              <span className="text-lg font-black">
                {offering?.TOTALNUMBERALREADYINVESTED || "0"}
              </span>
            </div>
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Non-Accredited Invs.
              </span>
              <span className="text-lg font-black">
                {offering?.HASNONACCREDITEDINVESTORS ? "YES" : "NO"}
              </span>
            </div>
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Gross Proceeds Used
              </span>
              <span className="text-lg font-black text-red-600">
                $
                {Number(
                  offering?.GROSSPROCEEDSUSED_DOLLARAMOUNT || 0,
                ).toLocaleString()}
              </span>
            </div>
            <div className="p-4">
              <span className="font-sans font-bold text-[10px] uppercase text-black block">
                Sales Commissions
              </span>
              <span className="text-lg font-black text-red-600">
                $
                {Number(offering?.SALESCOMM_DOLLARAMOUNT || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        {/* Section 2.5: Discovered Investors */}
        <section className="border-2 border-black bg-white">
          <div className="bg-zinc-100 p-2 border-b-2 border-black font-black uppercase text-xs tracking-wide flex justify-between">
            <span>Discovered Investors</span>
            <span>{discoveredInvestors.length} Found</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b-2 border-black text-[10px] font-black uppercase tracking-wider text-black">
                  <th className="p-3 border-r-2 border-black">Investor</th>
                  <th className="p-3 border-r-2 border-black">Type</th>
                  <th className="p-3 border-r-2 border-black">Role</th>
                  <th className="p-3 border-r-2 border-black">Confidence</th>
                  <th className="p-3 border-r-2 border-black">Method</th>
                  <th className="p-3">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black font-bold">
                {discoveredInvestors.length > 0 ? (
                  discoveredInvestors.map((inv: any) => (
                    <tr key={inv.id} className="text-black align-top">
                      <td className="p-3 border-r-2 border-black font-black uppercase">
                        {inv.investor_name}
                      </td>
                      <td className="p-3 border-r-2 border-black text-xs uppercase">
                        {inv.investor_type || "Unknown"}
                      </td>
                      <td className="p-3 border-r-2 border-black text-xs uppercase">
                        {inv.role || "Unknown"}
                      </td>
                      <td className="p-3 border-r-2 border-black text-xs">
                        <span
                          className={`px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] ${
                            inv.confidence === "high"
                              ? "bg-[#2596BE]"
                              : inv.confidence === "medium"
                                ? "bg-zinc-200"
                                : "bg-white"
                          }`}
                        >
                          {inv.confidence || "low"}
                        </span>
                      </td>
                      <td className="p-3 border-r-2 border-black text-xs uppercase">
                        {inv.discovery_method === "board_seat_hack"
                          ? "Board Seat"
                          : "Smart Search"}
                      </td>
                      <td className="p-3 text-xs font-normal">
                        {inv.evidence && (
                          <p className="text-zinc-600 mb-1">{inv.evidence}</p>
                        )}
                        {inv.source_url && (
                          <a
                            href={inv.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-[#2596BE] break-all"
                          >
                            {inv.source_url}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center font-black text-zinc-500 uppercase text-sm"
                    >
                      No investors discovered yet for this company. This section
                      populates automatically once the daily investor search runs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Operational Data & Corporate Identity */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-black bg-white">
            <div className="bg-zinc-100 p-2 border-b-2 border-black font-black uppercase text-xs tracking-wide">
              Corporate Headquarters
            </div>
            <div className="p-4 space-y-3 font-bold text-sm text-black">
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Street Address
                </span>
                {issuer.STREET1} {issuer.STREET2 ? `, ${issuer.STREET2}` : ""}
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  City, State, Zip
                </span>
                {issuer.CITY}, {issuer.STATEORCOUNTRY} {issuer.ZIPCODE}
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Contact Number
                </span>
                {issuer.ISSUERPHONENUMBER || "N/A"}
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Jurisdiction of Inc.
                </span>
                {issuer.JURISDICTIONOFINC || "N/A"}
              </p>
            </div>
          </div>

          <div className="border-2 border-black bg-white">
            <div className="bg-zinc-100 p-2 border-b-2 border-black font-black uppercase text-xs tracking-wide">
              Filing Classification
            </div>
            <div className="p-4 space-y-3 font-bold text-sm text-black">
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Entity Legal Structure
                </span>
                {issuer.ENTITYTYPE || "Corporation"}
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Revenue Range Class
                </span>
                {offering?.REVENUERANGE || "Decline to Disclose"}
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  SEC Industrial Code (SIC)
                </span>
                <span className="font-mono">
                  {submission?.SIC_CODE || "N/A"}
                </span>
              </p>
              <p>
                <span className="text-[10px] uppercase block text-zinc-500">
                  Year of Incorporation
                </span>
                {issuer.YEAROFINC_VALUE_ENTERED || "N/A"}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Related Persons (Founders & Leadership Team) */}
        <section className="border-2 border-black bg-white">
          <div className="bg-[#2596BE] p-2 border-b-2 border-black font-black uppercase text-sm tracking-wide">
            Management & Related Personnel ({relatedPersons.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b-2 border-black text-[10px] font-black uppercase tracking-wider text-black">
                  <th className="p-3 border-r-2 border-black">Full Name</th>
                  <th className="p-3 border-r-2 border-black">
                    Primary Relationships
                  </th>
                  <th className="p-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black font-bold">
                {relatedPersons.length > 0 ? (
                  relatedPersons.map((person: any) => (
                    <tr key={person.id} className="text-black">
                      <td className="p-3 border-r-2 border-black font-black uppercase">
                        {person.FIRSTNAME}{" "}
                        {person.MIDDLENAME ? `${person.MIDDLENAME} ` : ""}
                        {person.LASTNAME}
                      </td>
                      <td className="p-3 border-r-2 border-black text-xs">
                        <div className="flex gap-2 flex-wrap">
                          {person.RELATIONSHIP_1 && (
                            <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                              {person.RELATIONSHIP_1}
                            </span>
                          )}
                          {person.RELATIONSHIP_2 && (
                            <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                              {person.RELATIONSHIP_2}
                            </span>
                          )}
                          {person.RELATIONSHIP_3 && (
                            <span className="px-2 py-0.5 border-2 border-black uppercase font-bold text-[10px] bg-white">
                              {person.RELATIONSHIP_3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 uppercase text-xs">
                        {person.CITY && person.STATEORCOUNTRY
                          ? `${person.CITY}, ${person.STATEORCOUNTRY}`
                          : "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-6 text-center font-black text-zinc-500 uppercase text-sm"
                    >
                      No listed executives or related personnel attached to this
                      submission packet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Historical Filing Timeline */}
        <section className="border-2 border-black bg-white mb-12">
          <div className="bg-black text-white p-2 border-b-2 border-black font-black uppercase text-sm tracking-wide flex justify-between">
            <span>Filing History & Amendments</span>
            <span className="text-[#2596BE]">
              {filingHistory?.length || 0} Total Records
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-100 border-b-2 border-black text-[10px] font-black uppercase tracking-wider text-black">
                  <th className="p-3 border-r-2 border-black">Filing Date</th>
                  <th className="p-3 border-r-2 border-black">Type</th>
                  <th className="p-3 border-r-2 border-black text-right">
                    Target Raise
                  </th>
                  <th className="p-3 border-r-2 border-black text-right">
                    Amount Sold
                  </th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black font-bold">
                {filingHistory && filingHistory.length > 0 ? (
                  filingHistory.map((history: any) => (
                    <tr
                      key={history.ACCESSIONNUMBER}
                      className={`text-black ${history.ACCESSIONNUMBER === accessionNumber ? "bg-[#2596BE]/20" : "hover:bg-zinc-50 transition-none"}`}
                    >
                      <td className="p-3 border-r-2 border-black font-mono text-xs">
                        {history.filing_date}
                      </td>
                      <td className="p-3 border-r-2 border-black uppercase text-xs">
                        {history.submission_type === "D/A" ? (
                          <span className="bg-black text-white px-2 py-0.5 tracking-wider">
                            D/A (Amendment)
                          </span>
                        ) : (
                          <span className="bg-white border-2 border-black px-2 py-0.5 tracking-wider">
                            D (New Notice)
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-r-2 border-black text-right font-mono">
                        ${Number(history.target_raise || 0).toLocaleString()}
                      </td>
                      <td className="p-3 border-r-2 border-black text-right font-mono text-emerald-800">
                        ${Number(history.amount_sold || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        {history.ACCESSIONNUMBER === accessionNumber ? (
                          <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">
                            Current View
                          </span>
                        ) : (
                          <Link
                            href={`/company/${history.ACCESSIONNUMBER}`}
                            className="px-3 py-1 border-2 border-black bg-white hover:bg-[#2596BE] uppercase text-[10px] tracking-wider font-black transition-none"
                          >
                            View Profile
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center font-black text-zinc-500 uppercase text-sm"
                    >
                      No historical filings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
