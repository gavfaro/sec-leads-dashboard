// Ported from math_engine/data_puller.py's fetch_investor_data().
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact, VerticalFocusRow } from "./types";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Returns one entry per contact (individual investor) -- this is what actually
// gets scored and recommended, not the firm. Each contact carries:
//   - their personal deal history (contact_investments), with investment_stage /
//     year_partnered borrowed from their firm's portfolio_investments for the same
//     company, since contact_investments itself has neither column
//   - their firm's aggregate vertical_focus / typical_check_size as a fallback,
//     since individual partners don't have their own (contact_verticals is used
//     when present, falls back to the firm's when not)
export async function fetchInvestorData(sb: SupabaseClient): Promise<Contact[]> {
  const orgsRes = await sb
    .from("organizations")
    .select("id, aum, vertical_focus(preferred_stage, typical_check_size, verticals(vertical_name))");
  if (orgsRes.error) throw new Error(orgsRes.error.message);

  const orgVerticalFocus = new Map<string, VerticalFocusRow[]>();
  for (const o of (orgsRes.data ?? []) as any[]) {
    const rows = (o.vertical_focus ?? []).map((vf: any) => ({
      preferred_stage: vf.preferred_stage ?? null,
      typical_check_size: vf.typical_check_size ?? null,
      verticals: one(vf.verticals),
    }));
    orgVerticalFocus.set(o.id, rows);
  }

  const piRes = await sb
    .from("portfolio_investments")
    .select("org_id, company_id, investment_stage, year_partnered");
  if (piRes.error) throw new Error(piRes.error.message);

  const stageByOrgCompany = new Map<string, { investment_stage: string | null; year_partnered: number | null }>();
  for (const pi of piRes.data ?? []) {
    stageByOrgCompany.set(`${pi.org_id}:${pi.company_id}`, {
      investment_stage: pi.investment_stage,
      year_partnered: pi.year_partnered,
    });
  }

  const contactsRes = await sb
    .from("contacts")
    .select(
      "id, first_name, last_name, role, linkedin_url, bio, org_id, typical_check_size, " +
        "organizations(name), " +
        "contact_verticals(verticals(vertical_name)), " +
        "contact_investments(relationship, company_id, companies(name, description))",
    );
  if (contactsRes.error) throw new Error(contactsRes.error.message);

  const contacts: Contact[] = [];
  for (const c of (contactsRes.data ?? []) as any[]) {
    const orgId = c.org_id;
    const org = one<{ name: string }>(c.organizations);

    const investments = (c.contact_investments ?? []).map((ci: any) => {
      const company = one<{ name: string; description: string | null }>(ci.companies);
      const borrowed = stageByOrgCompany.get(`${orgId}:${ci.company_id}`);
      return {
        company_name: company?.name ?? null,
        description: company?.description ?? null,
        relationship: ci.relationship ?? null,
        investment_stage: borrowed?.investment_stage ?? null,
        year_partnered: borrowed?.year_partnered ?? null,
      };
    });

    const contactVerticals = (c.contact_verticals ?? [])
      .map((cv: any) => one<{ vertical_name: string }>(cv.verticals)?.vertical_name)
      .filter((v: string | undefined): v is string => Boolean(v));

    contacts.push({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      role: c.role ?? null,
      linkedin_url: c.linkedin_url ?? null,
      bio: c.bio ?? "",
      org_id: orgId,
      org_name: org?.name ?? null,
      typical_check_size: c.typical_check_size ?? null,
      contact_verticals: contactVerticals,
      org_vertical_focus: orgVerticalFocus.get(orgId) ?? [],
      investments,
    });
  }

  return contacts;
}
