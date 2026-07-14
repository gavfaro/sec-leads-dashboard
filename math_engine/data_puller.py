import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

# math_engine/ sits directly under the repo root, so .env is one level up.
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=root_dir / ".env")


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
              "SUPABASE_SERVICE_ROLE_KEY in .env.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def fetch_investor_data() -> list[dict]:
    """
    Returns one dict per contact (individual investor) -- this is what actually gets
    scored and recommended now, not the firm. Each contact carries:
      - their personal deal history (contact_investments), with investment_stage /
        year_partnered borrowed from their firm's portfolio_investments for the same
        company, since contact_investments itself has neither column
      - their firm's aggregate vertical_focus / typical_check_size as a fallback,
        since individual partners don't have their own (contact_verticals exists but
        is currently unpopulated everywhere -- used when present, falls back to the
        firm's when not)
    """
    supabase = get_supabase()

    orgs_res = (
        supabase.table("organizations")
        .select(
            "id, aum, "
            "vertical_focus(preferred_stage, typical_check_size, verticals(vertical_name))"
        )
        .execute()
    )
    org_context = {o["id"]: o for o in orgs_res.data}

    pi_res = (
        supabase.table("portfolio_investments")
        .select("org_id, company_id, investment_stage, year_partnered")
        .execute()
    )
    stage_by_org_company = {(pi["org_id"], pi["company_id"]): pi for pi in pi_res.data}

    contacts_res = (
        supabase.table("contacts")
        .select(
            "id, first_name, last_name, role, linkedin_url, bio, org_id, "
            "organizations(name), "
            "contact_verticals(verticals(vertical_name)), "
            "contact_investments(relationship, company_id, companies(name, description))"
        )
        .execute()
    )

    contacts = []
    for c in contacts_res.data:
        org_id = c["org_id"]
        org = c.get("organizations") or {}

        investments = []
        for ci in c.get("contact_investments") or []:
            company = ci.get("companies") or {}
            borrowed = stage_by_org_company.get((org_id, ci.get("company_id")), {})
            investments.append({
                "company_name": company.get("name"),
                "description": company.get("description"),
                "relationship": ci.get("relationship"),
                "investment_stage": borrowed.get("investment_stage"),
                "year_partnered": borrowed.get("year_partnered"),
            })

        contacts.append({
            "id": c["id"],
            "name": f"{c['first_name']} {c['last_name']}".strip(),
            "role": c.get("role"),
            "linkedin_url": c.get("linkedin_url"),
            "bio": c.get("bio") or "",
            "org_id": org_id,
            "org_name": org.get("name"),
            "contact_verticals": [
                cv["verticals"]["vertical_name"]
                for cv in (c.get("contact_verticals") or [])
                if cv.get("verticals")
            ],
            "org_vertical_focus": (org_context.get(org_id) or {}).get("vertical_focus") or [],
            "investments": investments,
        })

    return contacts


def fetch_verticals() -> list[dict]:
    """All known verticals, for mapping a startup's free-text sector tags onto our taxonomy."""
    supabase = get_supabase()
    return supabase.table("verticals").select("id, vertical_name").execute().data


if __name__ == "__main__":
    data = fetch_investor_data()
    print(f"Fetched {len(data)} contacts.")
    if data:
        print(data[0])
