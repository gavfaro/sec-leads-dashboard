"""
Delete all Tribeca Venture Partners data from the DB so a failed scrape can be fully redone.

Deletion order respects FK constraints:
  contact_investments → contacts → portfolio_investments → vertical_focus → organizations

Run: python investor_scraper/cleanup_tribeca.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

ORG_NAME = "Tribeca Venture Partners"


def main() -> None:
    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    org_res = sb.table("organizations").select("id").eq("name", ORG_NAME).execute()
    if not org_res.data:
        print(f"No organization named '{ORG_NAME}' found — nothing to delete.")
        return

    org_id = org_res.data[0]["id"]
    print(f"Found {ORG_NAME} org_id: {org_id}")

    contacts_res = sb.table("contacts").select("id").eq("org_id", org_id).execute()
    contact_ids = [c["id"] for c in contacts_res.data]
    print(f"Found {len(contact_ids)} contacts")

    if contact_ids:
        ci = sb.table("contact_investments").delete().in_("contact_id", contact_ids).execute()
        print(f"Deleted {len(ci.data)} contact_investments")
        c = sb.table("contacts").delete().eq("org_id", org_id).execute()
        print(f"Deleted {len(c.data)} contacts")

    pi = sb.table("portfolio_investments").delete().eq("org_id", org_id).execute()
    print(f"Deleted {len(pi.data)} portfolio_investments")

    vf = sb.table("vertical_focus").delete().eq("org_id", org_id).execute()
    print(f"Deleted {len(vf.data)} vertical_focus rows")

    org = sb.table("organizations").delete().eq("id", org_id).execute()
    print(f"Deleted {len(org.data)} organization")
    print("Done.")


if __name__ == "__main__":
    main()
