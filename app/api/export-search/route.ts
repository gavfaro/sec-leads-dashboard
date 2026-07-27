import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFundraisingQuery, getFundraisingSort } from "@/lib/fundraisingSearch";

// Hard cap so a broad/empty filter can't trigger an unbounded export.
const EXPORT_ROW_LIMIT = 5000;

const EXPORT_COLUMNS =
  "company_name, cik, city, state, zip_code, industry, entity_type, " +
  "investment_fund_type, submission_type, filing_date, target_raise, " +
  "is_indefinite_offering, amount_sold, min_investment, revenue_range, " +
  "federal_exemptions, has_non_accredited_investors, issuer_phone, ACCESSIONNUMBER";

const CSV_HEADER = [
  "Company Name",
  "CIK",
  "City",
  "State/Country",
  "Zip Code",
  "Industry",
  "Entity Type",
  "Fund Type",
  "Filing Type",
  "Filing Date",
  "Target Raise",
  "Indefinite Offering",
  "Amount Sold",
  "Min Investment",
  "Revenue Range",
  "Federal Exemptions",
  "Has Non-Accredited Investors",
  "Phone",
  "Accession Number",
];

type Cell = string | number | boolean | null | undefined;

function escapeCsvCell(value: Cell): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
  const { column: sortColumn, ascending: sortAscending } = getFundraisingSort(
    filters.sort,
  );

  const query = buildFundraisingQuery(supabase, EXPORT_COLUMNS, filters);
  const { data: rows, error } = await query
    .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
    .order("issuer_id", { ascending: sortAscending })
    .range(0, EXPORT_ROW_LIMIT - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csvRows = [
    CSV_HEADER,
    ...(rows || []).map((r) => [
      r.company_name,
      r.cik,
      r.city,
      r.state,
      r.zip_code,
      r.industry,
      r.entity_type,
      r.investment_fund_type,
      r.submission_type,
      r.filing_date,
      r.target_raise,
      r.is_indefinite_offering,
      r.amount_sold,
      r.min_investment,
      r.revenue_range,
      r.federal_exemptions,
      r.has_non_accredited_investors,
      r.issuer_phone,
      r.ACCESSIONNUMBER,
    ]),
  ];

  const csv = csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  // Leading BOM so Excel detects UTF-8 instead of mangling special characters.
  const body = "﻿" + csv;
  const fileName = `sec-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8;",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
