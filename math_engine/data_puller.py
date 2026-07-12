import os
import re
import sys
import time
import random
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import create_client, Client

# ==========================================
# 1. SUPABASE SETUP
# ==========================================
root_dir = Path(__file__).resolve().parent.parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# To fix the "violates row-level security policy" error, use the Service Role Key. 
# We default to it here, and fallback to the Anon key if it's missing.
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") 

if not url or not key:
    print("ERROR: Supabase URL or Key not found in .env")
    sys.exit(1)

supabase: Client = create_client(url, key)

if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    print("WARNING: Using Anon Key. If RLS is enabled, upserts will likely fail with a 42501 error.")

# ==========================================
# 2. CONFIGURATION (Dynamic via firms_config)
# ==========================================
try:
    from firms_config import FIRMS
except ImportError:
    print("ERROR: Could not import FIRMS from firms_config.py.")
    sys.exit(1)

# Grab Sequoia from the config list
target_firm = next((firm for firm in FIRMS if firm["name"] == "Sequoia"), None)

if not target_firm:
    print("ERROR: 'Sequoia' not found in firms_config.py.")
    sys.exit(1)

FIRM_NAME = target_firm["name"]
FIRM_WEBSITE = target_firm["website"]
URL = target_firm["portfolio_url"]

# ==========================================
# 3. PLAYWRIGHT & UPSERT LOGIC
# ==========================================
def scrape_and_upsert():
    # Ensure the Firm exists in Supabase BEFORE starting the browser scrape
    print(f"Verifying firm '{FIRM_NAME}' in Supabase...")
    firm_res = supabase.table("firms").upsert({"name": FIRM_NAME, "website": FIRM_WEBSITE}, on_conflict="name").execute()
    
    if firm_res.data:
        firm_id = firm_res.data[0]["id"]
    else:
        firm_id = supabase.table("firms").select("id").eq("name", FIRM_NAME).single().execute().data["id"]

    upsert_count = 0

    with sync_playwright() as p:
        # headless=False so you can watch it work. 
        # Change to True later if running on a server.
        browser = p.chromium.launch(headless=False) 
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        print(f"Loading {URL} ...")
        page.goto(URL, wait_until="networkidle", timeout=60000)

        # Dismiss cookie banners if they exist
        for btn_text in ["Accept", "Accept all", "I agree", "Got it"]:
            try:
                page.click(f"text={btn_text}", timeout=2000)
                break
            except:
                pass

        # Expand the full list via "Load More"
        print("Expanding full list...")
        consecutive_fails = 0
        click_count = 0
        
        while consecutive_fails < 3:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)
            
            clicked = page.evaluate("""() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const loadMoreBtn = buttons.find(b => b.innerText.toLowerCase().includes('load more'));
                if (loadMoreBtn && !loadMoreBtn.disabled && loadMoreBtn.offsetParent !== null) {
                    loadMoreBtn.click();
                    return true;
                }
                return false;
            }""")
            
            if not clicked:
                consecutive_fails += 1
            else:
                consecutive_fails = 0
                click_count += 1
                # Random human-like delay between scrolls
                page.wait_for_timeout(random.randint(1500, 2500)) 

        print(f"Finished loading list ({click_count} load-more clicks). Starting data extraction...")

        # Loop through every row that can be collapsed/expanded
        parent_rows = page.locator('tr[data-toggle="collapse"]').all()
        print(f"Found {len(parent_rows)} companies. Processing and Upserting...")

        for row in parent_rows:
            try:
                # Get the target ID for the expanded container (e.g., "#company_listing-218")
                target_id = row.get_attribute('data-target') 
                if not target_id:
                    continue

                # Parse the parent row visible columns
                tds = row.locator('td, th').all()
                source_id = tds[0].inner_text().strip()
                company_name = tds[1].inner_text().strip()
                short_desc = tds[2].inner_text().strip()
                stage = tds[3].inner_text().strip()
                partners_text = tds[4].inner_text().strip()
                first_partnered_text = tds[5].inner_text().strip()

                # Extract the 4 digit year
                year_match = re.search(r'\((\d{4})\)', first_partnered_text)
                first_partnered_year = int(year_match.group(1)) if year_match else None

                # Click the '+' toggle button to open the row
                tds[6].click()
                
                # Wait for the expanded container to appear
                expanded_container = page.locator(target_id)
                
                # Wait for the "Loading" text to disappear and the real HTML to render from the PHP response
                expanded_container.locator('section.company').wait_for(state='visible', timeout=15000)

                # Now extract the rich data from the expanded view
                try:
                    full_description = expanded_container.locator('.wysiwyg p').first.inner_text().strip()
                except:
                    full_description = short_desc
                    
                try:
                    website_url = expanded_container.locator('a.button[target="_blank"]').first.get_attribute('href')
                except:
                    website_url = None

                try:
                    linkedin_url = expanded_container.locator('a.ico--linkedin').first.get_attribute('href')
                except:
                    linkedin_url = None

                try:
                    twitter_url = expanded_container.locator('a.ico--twitter').first.get_attribute('href')
                except:
                    twitter_url = None

                tags = []
                try:
                    category_pills = expanded_container.locator('a.pill--facet').all()
                    tags = [pill.inner_text().strip() for pill in category_pills if pill.inner_text().strip()]
                except:
                    pass

                # ----------------------------------------------------
                # IMMEDIATE UPSERT LOGIC
                # ----------------------------------------------------
                comp_payload = {
                    "name": company_name, 
                    "description": full_description
                }
                if website_url:
                    comp_payload["website"] = website_url
                if linkedin_url:
                    comp_payload["linkedin_url"] = linkedin_url
                if twitter_url:
                    comp_payload["twitter_url"] = twitter_url
                if tags:
                    comp_payload["categories"] = tags

                # Insert/Update Company
                company_res = supabase.table("companies").upsert(comp_payload, on_conflict="name").execute()
                
                if company_res.data:
                    company_id = company_res.data[0]["id"]
                else:
                    company_id = supabase.table("companies").select("id").eq("name", company_name).single().execute().data["id"]

                # Insert/Update Investment record linking Firm to Company
                supabase.table("investments").upsert(
                    {
                        "firm_id": firm_id,
                        "company_id": company_id,
                        "source_company_id": source_id,
                        "stage": stage,
                        "first_partnered": first_partnered_text,
                        "first_partnered_year": first_partnered_year,
                        "partners": partners_text,
                        "source_url": URL,
                    },
                    on_conflict="firm_id,source_company_id",
                ).execute()
                
                upsert_count += 1
                print(f"[{upsert_count}/{len(parent_rows)}] Scraped and Upserted: {company_name}")

            except Exception as e:
                print(f"Skipped a row due to error: {e}")

        browser.close()
        return upsert_count

# ==========================================
# 4. MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    count = scrape_and_upsert()
    print(f"\nSuccessfully processed and upserted {count} investment records for {FIRM_NAME}.")