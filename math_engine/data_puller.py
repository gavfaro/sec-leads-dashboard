import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Set up the Supabase client
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") 
supabase: Client = create_client(url, key)

def fetch_raw_startup_data(limit: int = 100):
    """
    Fetches raw startup data from Supabase.

    limit: The maximum number of records to fetch.
    """
    # Since the tables are disjoint, we need to fetch them independently.
    # The accession numbers is what we'll use to link the two tables, and we'll use the issuers as the primary table.
    # Currently we only fetch some of the data, we'll need to expand this in the future

    issuers_response = (
        supabase.table("issuers")
        .select("ACCESSIONNUMBER", "CIK", "ENTITYNAME", "STATEORCOUNTRY")
        .limit(limit)
        .execute()
    )
    issuers_data = issuers_response.data
    accession_numbers = [row["ACCESSIONNUMBER"] for row in issuers_data if "ACCESSIONNUMBER" in row]

    print(f"Fetching offerings for {len(accession_numbers)} specific accession numbers...")

    # 3. Fetch Offerings that specifically match our list of issuers
    offering_response = (
        supabase.table("offering")
        .select("ACCESSIONNUMBER", "INDUSTRYGROUPTYPE", "TOTALOFFERINGAMOUNT", "MINIMUMINVESTMENTACCEPTED")
        .in_("ACCESSIONNUMBER", accession_numbers)  # <-- This guarantees they sync
        .execute()
    )
    offering_data = offering_response.data

    # for some reason ai_profile does not have an accession number, so we'll use cik
    # ciks = [row["CIK"] for row in issuers_data if "CIK" in row]

    # ai_profile_response = (
    #     supabase.table("ai_profile")
    #     .select("CIK", "ai_summary")
    #     .in_("CIK", ciks)
    #     .execute()
    # )
    # ai_profile_data = ai_profile_response.data

    # 4. Create a lookup dictionary for offerings keyed by ACCESSIONNUMBER
    offering_lookup = {row["ACCESSIONNUMBER"]: row for row in offering_data if "ACCESSIONNUMBER" in row}

    # 5. Merge the data in Python
    merged_data = []
    for issuer in issuers_data:
        accession_num = issuer.get("ACCESSIONNUMBER")
        
        # Grab the matching offering data, or an empty dict if none exists
        matching_offering = offering_lookup.get(accession_num, {})
        
        # --- DATA CLEANING & TYPE CASTING ---
        raw_amount_str = matching_offering.get("TOTALOFFERINGAMOUNT")
        
        try:
            if not raw_amount_str or str(raw_amount_str).strip().lower() in ["", "none", "null"]:
                clean_amount = 0.0
            else:
                # Strip commas and cast to a strict Python float
                clean_string = str(raw_amount_str).replace(",", "").strip()
                clean_amount = float(clean_string)
        except ValueError:
            clean_amount = 0.0 
            
        # Overwrite the dirty string with our clean float
        matching_offering["TOTALOFFERINGAMOUNT"] = clean_amount
        # ------------------------------------
        
        # Combine the two dictionaries using the ** unpacking operator
        combined_row = {**issuer, **matching_offering}
        merged_data.append(combined_row)
    
    return merged_data

if __name__ == "__main__":
    # Test the extraction
    raw_data = fetch_raw_startup_data(limit=5)

    if raw_data:
        print(f"\nSuccessfully pulled {len(raw_data)} fully merged records.")
        for i in range(min(5, len(raw_data))):
            print(raw_data[i])
    else:
        print("No data found.")