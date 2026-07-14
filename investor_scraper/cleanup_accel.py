"""
Delete all Accel data from the DB so a failed scrape can be fully redone.

Deletion order respects FK constraints:
  contact_investments → contacts → portfolio_investments → organizations

Run: python investor_scraper/cleanup_accel.py
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

ACCEL_ORG_NAME = "Accel"

def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    sb = create_client(url, key)

    org_res = sb.table("organizations").select("id").eq("name", ACCEL_ORG_NAME).execute()
    if not org_res.data:
        print(f"No organization named '{ACCEL_ORG_NAME}' found — nothing to delete.")
        return

    org_id = org_res.data[0]["id"]
    print(f"Found Accel org_id: {org_id}")

    contacts_res = sb.table("contacts").select("id").eq("org_id", org_id).execute()
    contact_ids = [c["id"] for c in contacts_res.data]
    print(f"Found {len(contact_ids)} contacts")

    if contact_ids:
        ci_res = sb.table("contact_investments").delete().in_("contact_id", contact_ids).execute()
        print(f"Deleted {len(ci_res.data)} contact_investments")

        c_res = sb.table("contacts").delete().eq("org_id", org_id).execute()
        print(f"Deleted {len(c_res.data)} contacts")

    pi_res = sb.table("portfolio_investments").delete().eq("org_id", org_id).execute()
    print(f"Deleted {len(pi_res.data)} portfolio_investments")

    org_del = sb.table("organizations").delete().eq("id", org_id).execute()
    print(f"Deleted {len(org_del.data)} organization")
    print("Done.")

if __name__ == "__main__":
    main()
