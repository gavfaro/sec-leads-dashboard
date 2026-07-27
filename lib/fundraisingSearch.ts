import type { SupabaseClient } from "@supabase/supabase-js";

// Shared between app/page.tsx (paginated table) and
// app/api/export-search/route.ts (CSV export) so the exported rows always
// match whatever the on-screen filters actually selected.
export interface FundraisingFilters {
  name?: string;
  cik?: string;
  city?: string;
  state?: string;
  industry?: string;
  entityType?: string;
  fundType?: string;
  type?: string;
  minRaise?: string;
  maxRaise?: string;
  offeringType?: string;
  minSold?: string;
  maxSold?: string;
  minCheck?: string;
  maxCheck?: string;
  revenueRange?: string;
  exemption?: string;
  accredited?: string;
  phoneOnly?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export const FILTER_KEYS = [
  "name",
  "cik",
  "city",
  "state",
  "industry",
  "entityType",
  "fundType",
  "type",
  "minRaise",
  "maxRaise",
  "offeringType",
  "minSold",
  "maxSold",
  "minCheck",
  "maxCheck",
  "revenueRange",
  "exemption",
  "accredited",
  "phoneOnly",
  "dateFrom",
  "dateTo",
  "sort",
] as const satisfies readonly (keyof FundraisingFilters)[];

const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  date_desc: { column: "filing_date_parsed", ascending: false },
  date_asc: { column: "filing_date_parsed", ascending: true },
  raise_desc: { column: "target_raise_numeric", ascending: false },
  sold_desc: { column: "amount_sold", ascending: false },
  name_asc: { column: "company_name", ascending: true },
};

export function getFundraisingSort(sort?: string) {
  return SORT_MAP[sort || "date_desc"] || SORT_MAP.date_desc;
}

// `query` is a Supabase PostgrestFilterBuilder; typed loosely because its
// exact generic shape depends on the caller's .select() and .from() call.
export function applyFundraisingFilters<T>(query: T, params: FundraisingFilters): T {
  const nameSearch = params.name || "";
  const cik = params.cik || "";
  const city = params.city || "";
  const stateCode = params.state || "";
  const industry = params.industry || "";
  const entityType = params.entityType || "";
  const fundType = params.fundType || "";
  const submissionType = params.type || "";
  const minRaise = parseInt(params.minRaise || "", 10);
  const maxRaise = parseInt(params.maxRaise || "", 10);
  const offeringType = params.offeringType || "";
  const minSold = parseInt(params.minSold || "", 10);
  const maxSold = parseInt(params.maxSold || "", 10);
  const minCheck = parseInt(params.minCheck || "", 10);
  const maxCheck = parseInt(params.maxCheck || "", 10);
  const revenueRange = params.revenueRange || "";
  const exemption = params.exemption || "";
  const accredited = params.accredited || "";
  const phoneOnly = params.phoneOnly === "true";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  if (nameSearch) q = q.ilike("company_name", `%${nameSearch}%`);
  if (cik) q = q.eq("cik", parseInt(cik, 10));
  if (city) q = q.ilike("city", `%${city}%`);
  if (stateCode) q = q.ilike("state", stateCode);
  if (industry) q = q.eq("industry", industry);
  if (entityType) q = q.eq("entity_type", entityType);
  if (fundType === "NONE") q = q.is("investment_fund_type", null);
  else if (fundType) q = q.eq("investment_fund_type", fundType);
  if (submissionType) q = q.eq("submission_type", submissionType);

  if (!isNaN(minRaise)) q = q.gte("target_raise_numeric", minRaise);
  if (!isNaN(maxRaise)) q = q.lte("target_raise_numeric", maxRaise);
  if (offeringType === "fixed") q = q.eq("is_indefinite_offering", false);
  else if (offeringType === "indefinite") q = q.eq("is_indefinite_offering", true);

  if (!isNaN(minSold)) q = q.gte("amount_sold", minSold);
  if (!isNaN(maxSold)) q = q.lte("amount_sold", maxSold);

  if (!isNaN(minCheck)) q = q.gte("min_investment", minCheck);
  if (!isNaN(maxCheck)) q = q.lte("min_investment", maxCheck);

  if (revenueRange) q = q.eq("revenue_range", revenueRange);
  if (exemption) q = q.ilike("federal_exemptions", `%${exemption}%`);
  if (accredited) q = q.eq("has_non_accredited_investors", accredited === "true");
  if (phoneOnly) q = q.not("issuer_phone", "is", null);

  if (dateFrom) q = q.gte("filing_date_parsed", dateFrom);
  if (dateTo) q = q.lte("filing_date_parsed", dateTo);

  return q as T;
}

// `Columns` is generic (rather than typed as plain `string`) so the literal
// select-string callers pass through unwidened — that's what lets
// supabase-js's select() overloads infer a real row shape instead of falling
// back to GenericStringError.
export function buildFundraisingQuery<Columns extends string>(
  supabase: SupabaseClient,
  columns: Columns,
  filters: FundraisingFilters,
  options: { count?: "estimated" | "exact" } = {},
) {
  const query = supabase
    .from("company_fundraising_profiles")
    .select(columns, options.count ? { count: options.count } : undefined);
  return applyFundraisingFilters(query, filters);
}
