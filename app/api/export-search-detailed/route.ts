import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { buildFundraisingQuery, getFundraisingSort } from "@/lib/fundraisingSearch";
import type { SupabaseClient } from "@supabase/supabase-js";

// A detailed export fans each matching company out into 5 more tables
// (issuers, offering, submissions, related_persons, discovered_investors,
// plus a filing-history self-join) — kept well below the flat CSV export's
// 5,000-row cap so the batched fetches below stay inside a serverless
// function's execution time budget.
const EXPORT_ROW_LIMIT = 1000;

// PostgREST sends `.in()` filters as a query string — chunking keeps each
// request's IN-list comfortably under URL length limits and keeps any single
// request fast, while Promise.all keeps total wall time to ~1 round trip
// per table regardless of how many companies matched (no N+1).
const CHUNK_SIZE = 300;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchChunked<Row>(
  ids: Array<string | number>,
  // PromiseLike, not Promise: supabase-js query builders (e.g. the chained
  // .select().in() below) are thenable but aren't real Promise instances —
  // they don't have .catch/.finally, so Promise<...> rejects them at the
  // type level even though `await` and Promise.all both handle them fine.
  run: (
    idsChunk: Array<string | number>,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  if (ids.length === 0) return [];
  const results = await Promise.all(chunk(ids, CHUNK_SIZE).map(run));
  const rows: Row[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    if (data) rows.push(...data);
  }
  return rows;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2596BE" } };
}

function formatOfferingAmount(value: string | number | null | undefined) {
  if (value === "Indefinite") return "Indefinite";
  if (value === null || value === undefined) return "";
  return `$${Number(value || 0).toLocaleString()}`;
}

type Cell = string | number | boolean | null | undefined;

interface CompanyRow {
  issuer_id: number;
  cik: number | string;
  company_name: string | null;
  ACCESSIONNUMBER: string;
  filing_date: string | null;
  submission_type: string | null;
  industry: string | null;
  entity_type: string | null;
  investment_fund_type: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  issuer_phone: string | null;
  jurisdiction_of_inc: string | null;
  revenue_range: string | null;
  target_raise: Cell;
  amount_sold: Cell;
  min_investment: Cell;
  federal_exemptions: string | null;
  total_number_already_invested: Cell;
  has_non_accredited_investors: boolean | null;
}

const COMPANY_COLUMNS =
  "issuer_id, cik, company_name, ACCESSIONNUMBER, filing_date, submission_type, " +
  "industry, entity_type, investment_fund_type, city, state, zip_code, issuer_phone, " +
  "jurisdiction_of_inc, revenue_range, target_raise, amount_sold, min_investment, " +
  "federal_exemptions, total_number_already_invested, has_non_accredited_investors";

async function fetchIssuersExtra(supabase: SupabaseClient, accessionNumbers: string[]) {
  return fetchChunked<{
    ACCESSIONNUMBER: string;
    ISSUER_PREVIOUSNAME_1: string | null;
    STREET1: string | null;
    STREET2: string | null;
    YEAROFINC_VALUE_ENTERED: string | null;
  }>(accessionNumbers, (ids) =>
    supabase
      .from("issuers")
      .select('"ACCESSIONNUMBER", "ISSUER_PREVIOUSNAME_1", "STREET1", "STREET2", "YEAROFINC_VALUE_ENTERED"')
      .in("ACCESSIONNUMBER", ids),
  );
}

async function fetchOfferingExtra(supabase: SupabaseClient, accessionNumbers: string[]) {
  return fetchChunked<{
    ACCESSIONNUMBER: string;
    TOTALREMAINING: Cell;
    GROSSPROCEEDSUSED_DOLLARAMOUNT: Cell;
    SALESCOMM_DOLLARAMOUNT: Cell;
  }>(accessionNumbers, (ids) =>
    supabase
      .from("offering")
      .select('"ACCESSIONNUMBER", "TOTALREMAINING", "GROSSPROCEEDSUSED_DOLLARAMOUNT", "SALESCOMM_DOLLARAMOUNT"')
      .in("ACCESSIONNUMBER", ids),
  );
}

async function fetchSubmissionsExtra(supabase: SupabaseClient, accessionNumbers: string[]) {
  return fetchChunked<{ ACCESSIONNUMBER: string; SIC_CODE: string | null }>(
    accessionNumbers,
    (ids) => supabase.from("submissions").select('"ACCESSIONNUMBER", "SIC_CODE"').in("ACCESSIONNUMBER", ids),
  );
}

async function fetchRelatedPersons(supabase: SupabaseClient, accessionNumbers: string[]) {
  return fetchChunked<{
    ACCESSIONNUMBER: string;
    FIRSTNAME: string | null;
    MIDDLENAME: string | null;
    LASTNAME: string | null;
    RELATIONSHIP_1: string | null;
    RELATIONSHIP_2: string | null;
    RELATIONSHIP_3: string | null;
    CITY: string | null;
    STATEORCOUNTRY: string | null;
  }>(accessionNumbers, (ids) =>
    supabase
      .from("related_persons")
      .select(
        '"ACCESSIONNUMBER", "FIRSTNAME", "MIDDLENAME", "LASTNAME", "RELATIONSHIP_1", "RELATIONSHIP_2", "RELATIONSHIP_3", "CITY", "STATEORCOUNTRY"',
      )
      .in("ACCESSIONNUMBER", ids),
  );
}

async function fetchDiscoveredInvestors(supabase: SupabaseClient, ciks: (string | number)[]) {
  return fetchChunked<{
    cik: number;
    investor_name: string;
    investor_type: string | null;
    role: string | null;
    confidence: string | null;
    discovery_method: string;
    evidence: string | null;
    source_url: string | null;
  }>(ciks, (ids) =>
    supabase
      .from("discovered_investors")
      .select("cik, investor_name, investor_type, role, confidence, discovery_method, evidence, source_url")
      .in("cik", ids),
  );
}

async function fetchFilingHistory(supabase: SupabaseClient, ciks: (string | number)[]) {
  return fetchChunked<{
    cik: number;
    company_name: string | null;
    ACCESSIONNUMBER: string;
    filing_date: string | null;
    submission_type: string | null;
    target_raise: Cell;
    amount_sold: Cell;
  }>(ciks, (ids) =>
    supabase
      .from("company_fundraising_profiles")
      .select("cik, company_name, ACCESSIONNUMBER, filing_date, submission_type, target_raise, amount_sold")
      .in("cik", ids)
      .order("filing_date_parsed", { ascending: false, nullsFirst: false }),
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const filters = Object.fromEntries(searchParams.entries());
  const { column: sortColumn, ascending: sortAscending } = getFundraisingSort(filters.sort);

  // "exportName" (not "name") — lib/fundraisingSearch.ts's FILTER_KEYS
  // already uses "name" for the Company Name filter, so reusing it here
  // would silently collide with that filter's value.
  const { exportName: rawExportName, ...storedFilters } = filters;
  const exportName =
    rawExportName?.trim() || `SEC Leads Export - ${new Date().toISOString().slice(0, 10)}`;

  const companyQuery = buildFundraisingQuery(supabase, COMPANY_COLUMNS, filters);
  const { data: companies, error: companiesError } = await companyQuery
    .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
    .order("issuer_id", { ascending: sortAscending })
    .range(0, EXPORT_ROW_LIMIT - 1);

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  const rows = (companies || []) as CompanyRow[];
  const accessionNumbers = [...new Set(rows.map((r) => r.ACCESSIONNUMBER).filter(Boolean))];
  const ciks = [...new Set(rows.map((r) => r.cik).filter((c): c is number => c !== null && c !== undefined))];

  let issuersExtra, offeringExtra, submissionsExtra, relatedPersons, discoveredInvestors, filingHistory;
  try {
    [issuersExtra, offeringExtra, submissionsExtra, relatedPersons, discoveredInvestors, filingHistory] =
      await Promise.all([
        fetchIssuersExtra(supabase, accessionNumbers),
        fetchOfferingExtra(supabase, accessionNumbers),
        fetchSubmissionsExtra(supabase, accessionNumbers),
        fetchRelatedPersons(supabase, accessionNumbers),
        fetchDiscoveredInvestors(supabase, ciks),
        fetchFilingHistory(supabase, ciks),
      ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch detailed export data" },
      { status: 500 },
    );
  }

  const issuersByAccession = new Map(issuersExtra.map((r) => [r.ACCESSIONNUMBER, r]));
  const offeringByAccession = new Map(offeringExtra.map((r) => [r.ACCESSIONNUMBER, r]));
  const submissionsByAccession = new Map(submissionsExtra.map((r) => [r.ACCESSIONNUMBER, r]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ellerra Intelligence";

  // --- Companies sheet ---
  const companiesSheet = wb.addWorksheet("Companies");
  companiesSheet.columns = [
    { header: "Entity Name", key: "name", width: 28 },
    { header: "Previous Name", key: "prevName", width: 22 },
    { header: "CIK", key: "cik", width: 12 },
    { header: "Accession Number", key: "accession", width: 24 },
    { header: "Filing Date", key: "filingDate", width: 14 },
    { header: "Filing Type", key: "filingType", width: 14 },
    { header: "Industry", key: "industry", width: 22 },
    { header: "Entity Type", key: "entityType", width: 18 },
    { header: "Fund Type", key: "fundType", width: 20 },
    { header: "Street Address", key: "street1", width: 24 },
    { header: "Street Address 2", key: "street2", width: 20 },
    { header: "City", key: "city", width: 16 },
    { header: "State/Country", key: "state", width: 14 },
    { header: "Zip Code", key: "zip", width: 12 },
    { header: "Phone Number", key: "phone", width: 16 },
    { header: "Jurisdiction of Inc.", key: "jurisdiction", width: 18 },
    { header: "Year of Inc.", key: "yearInc", width: 12 },
    { header: "SIC Code", key: "sic", width: 10 },
    { header: "Revenue Range", key: "revenue", width: 20 },
    { header: "Total Target Raise", key: "targetRaise", width: 18 },
    { header: "Total Amount Sold", key: "amountSold", width: 18 },
    { header: "Total Remaining", key: "remaining", width: 16 },
    { header: "Minimum Investment", key: "minInvestment", width: 18 },
    { header: "Federal Exemption", key: "exemption", width: 26 },
    { header: "Total Investors", key: "totalInvestors", width: 14 },
    { header: "Has Non-Accredited Investors", key: "nonAccredited", width: 16 },
    { header: "Gross Proceeds Used", key: "grossProceeds", width: 18 },
    { header: "Sales Commissions", key: "salesComm", width: 16 },
  ];
  styleHeaderRow(companiesSheet.getRow(1));
  for (const r of rows) {
    const iss = issuersByAccession.get(r.ACCESSIONNUMBER);
    const off = offeringByAccession.get(r.ACCESSIONNUMBER);
    const sub = submissionsByAccession.get(r.ACCESSIONNUMBER);
    companiesSheet.addRow({
      name: r.company_name ?? "",
      prevName: iss?.ISSUER_PREVIOUSNAME_1 ?? "",
      cik: r.cik ?? "",
      accession: r.ACCESSIONNUMBER,
      filingDate: r.filing_date ?? "",
      filingType: r.submission_type ?? "",
      industry: r.industry ?? "",
      entityType: r.entity_type ?? "",
      fundType: r.investment_fund_type ?? "",
      street1: iss?.STREET1 ?? "",
      street2: iss?.STREET2 ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      zip: r.zip_code ?? "",
      phone: r.issuer_phone ?? "",
      jurisdiction: r.jurisdiction_of_inc ?? "",
      yearInc: iss?.YEAROFINC_VALUE_ENTERED ?? "",
      sic: sub?.SIC_CODE ?? "",
      revenue: r.revenue_range ?? "",
      targetRaise: formatOfferingAmount(r.target_raise),
      amountSold: r.amount_sold ?? "",
      remaining: formatOfferingAmount(off?.TOTALREMAINING),
      minInvestment: r.min_investment ?? "",
      exemption: r.federal_exemptions ?? "",
      totalInvestors: r.total_number_already_invested ?? "",
      nonAccredited: r.has_non_accredited_investors ? "Yes" : "No",
      grossProceeds: off?.GROSSPROCEEDSUSED_DOLLARAMOUNT ?? "",
      salesComm: off?.SALESCOMM_DOLLARAMOUNT ?? "",
    });
  }

  // --- Related Persons sheet ---
  const personsSheet = wb.addWorksheet("Related Persons");
  personsSheet.columns = [
    { header: "Company Name", key: "company", width: 26 },
    { header: "Accession Number", key: "accession", width: 22 },
    { header: "Full Name", key: "name", width: 24 },
    { header: "Relationships", key: "relationships", width: 28 },
    { header: "City", key: "city", width: 16 },
    { header: "State/Country", key: "state", width: 14 },
  ];
  styleHeaderRow(personsSheet.getRow(1));
  const companyNameByAccession = new Map(rows.map((r) => [r.ACCESSIONNUMBER, r.company_name]));
  for (const p of relatedPersons) {
    personsSheet.addRow({
      company: companyNameByAccession.get(p.ACCESSIONNUMBER) ?? "",
      accession: p.ACCESSIONNUMBER,
      name: `${p.FIRSTNAME ?? ""} ${p.MIDDLENAME ? p.MIDDLENAME + " " : ""}${p.LASTNAME ?? ""}`.trim(),
      relationships: [p.RELATIONSHIP_1, p.RELATIONSHIP_2, p.RELATIONSHIP_3].filter(Boolean).join("; "),
      city: p.CITY ?? "",
      state: p.STATEORCOUNTRY ?? "",
    });
  }

  // --- Discovered Investors sheet ---
  const investorsSheet = wb.addWorksheet("Discovered Investors");
  investorsSheet.columns = [
    { header: "Company Name", key: "company", width: 26 },
    { header: "CIK", key: "cik", width: 12 },
    { header: "Investor", key: "investor", width: 26 },
    { header: "Type", key: "type", width: 16 },
    { header: "Role", key: "role", width: 16 },
    { header: "Confidence", key: "confidence", width: 12 },
    { header: "Method", key: "method", width: 16 },
    { header: "Evidence", key: "evidence", width: 40 },
    { header: "Source URL", key: "sourceUrl", width: 40 },
  ];
  styleHeaderRow(investorsSheet.getRow(1));
  const companyNameByCik = new Map(rows.map((r) => [r.cik, r.company_name]));
  for (const inv of discoveredInvestors) {
    investorsSheet.addRow({
      company: companyNameByCik.get(inv.cik) ?? "",
      cik: inv.cik,
      investor: inv.investor_name,
      type: inv.investor_type ?? "",
      role: inv.role ?? "",
      confidence: inv.confidence ?? "",
      method: inv.discovery_method === "board_seat_hack" ? "Board Seat" : "Smart Search",
      evidence: inv.evidence ?? "",
      sourceUrl: inv.source_url ?? "",
    });
  }

  // --- Filing History sheet ---
  const historySheet = wb.addWorksheet("Filing History");
  historySheet.columns = [
    { header: "Company Name", key: "company", width: 26 },
    { header: "CIK", key: "cik", width: 12 },
    { header: "Filing Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 20 },
    { header: "Target Raise", key: "target", width: 16 },
    { header: "Amount Sold", key: "sold", width: 16 },
    { header: "Accession Number", key: "accession", width: 24 },
  ];
  styleHeaderRow(historySheet.getRow(1));
  for (const h of filingHistory) {
    historySheet.addRow({
      company: h.company_name ?? "",
      cik: h.cik,
      date: h.filing_date ?? "",
      type: h.submission_type === "D/A" ? "D/A (Amendment)" : "D (New Notice)",
      target: h.target_raise ?? "",
      sold: h.amount_sold ?? "",
      accession: h.ACCESSIONNUMBER,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileBuffer = Buffer.from(buffer);
  // Same sanitization as /api/exports/[id]/download, so the file name is
  // identical whether it's downloaded now or redownloaded later from /exports.
  const fileName = `${exportName.replace(/[^\w.\- ]/g, "_")}.xlsx`;

  // Best-effort: save the file + a history row so it shows up under
  // /exports, but a failure here must never block the download the user is
  // actively waiting on.
  try {
    const exportId = crypto.randomUUID();
    const storagePath = `${user.id}/${exportId}.xlsx`;

    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(storagePath, fileBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from("export_history").insert({
      id: exportId,
      user_id: user.id,
      name: exportName,
      filters: storedFilters,
      row_count: rows.length,
      storage_path: storagePath,
      file_size: fileBuffer.byteLength,
    });
    if (insertError) throw insertError;
  } catch (err) {
    console.error("Failed to save export history:", err);
  }

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
