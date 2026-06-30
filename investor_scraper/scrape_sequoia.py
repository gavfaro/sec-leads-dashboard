"""
Scrape Sequoia Capital's "Our Companies" page and upsert into Supabase.

The page renders a <table> with virtual/infinite scroll inside its own
scroll container.  We scroll WITHIN that container (not the page) so the
JS load-more trigger fires properly.

Run:
    python scrape_sequoia.py
"""

import os
import re
import sys
import time
import random
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import create_client

FIRM_NAME = "Sequoia"
FIRM_WEBSITE = "https://sequoiacap.com"
URL = "https://sequoiacap.com/our-companies/"
MAX_STALLS = 8          # consecutive scroll attempts with no new rows before giving up
SCROLL_PAUSE_MS = 1800  # ms to wait after each scroll

root_dir = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=root_dir / ".env")


def get_supabase():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("ERROR: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("WARNING: using anon key — upserts may fail if RLS is enabled")
    return create_client(url, key)


def parse_table_rows(page):
    """Read every rendered <tr> from the table."""
    rows = page.eval_on_selector_all(
        "table tr",
        """
        (trs) => trs.map(tr => {
            const tds = Array.from(tr.querySelectorAll('td'));
            return tds.length >= 5 ? tds.map(td => td.innerText.trim()) : null;
        }).filter(Boolean)
        """,
    )
    parsed = {}
    for r in rows:
        source_id = r[0]
        if not source_id.isdigit():
            continue
        # Columns: ID | Name | Description | Partners | Stage+Year | [collapse btn]
        name, desc, partners, first_partnered = r[1], r[2], r[3], r[4]
        stage_m = re.match(r"^(.*?)\s*\(\d{4}\)", first_partnered)
        stage = stage_m.group(1).strip() if stage_m else ""
        parsed[source_id] = {
            "source_company_id": source_id,
            "name": name.strip(),
            "description": desc.strip(),
            "stage": stage,
            "partners": partners.strip(),
            "first_partnered": first_partnered.strip(),
        }
    return parsed



def scrape_sequoia():
    all_rows: dict = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        )
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        # Also intercept API calls — Sequoia may batch-load rows via XHR
        api_companies: list[dict] = []

        def on_response(resp):
            ct = resp.headers.get("content-type", "")
            if "json" not in ct:
                return
            try:
                data = resp.json()
            except Exception:
                return
            # Look for any list of objects with a 'name' key
            items = data if isinstance(data, list) else None
            if items is None and isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list) and v and isinstance(v[0], dict) and "name" in v[0]:
                        items = v
                        break
            if not items:
                return
            for item in items:
                if not isinstance(item, dict) or not item.get("name"):
                    continue
                api_companies.append(item)

        page.on("response", on_response)

        print(f"Loading {URL} ...")
        page.goto(URL, wait_until="networkidle", timeout=60000)

        # Dismiss cookie / consent banners
        for btn_text in ["Accept", "Accept all", "I agree", "Got it"]:
            try:
                page.click(f"text={btn_text}", timeout=2000)
                break
            except Exception:
                pass

        # Click "Load More" via JS (bypasses Playwright visibility checks).
        # Sequoia renders the button in the DOM but headless Chrome considers it
        # not visible until scrolled into view — JS click sidesteps this entirely.
        click_count = 0
        consecutive_no_growth = 0

        while consecutive_no_growth < 3:
            batch = parse_table_rows(page)
            prev_count = len(all_rows)
            all_rows.update(batch)
            print(f"  rows so far: {len(all_rows)}  (load-more clicks: {click_count})")

            # Scroll to bottom so the button is rendered
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(600)

            # JS: walk ALL text nodes, find "Load More", click its parent
            clicked = page.evaluate(
                """
                () => {
                    const walker = document.createTreeWalker(
                        document.body, NodeFilter.SHOW_TEXT
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                        if (/^\\s*load more\\s*$/i.test(node.textContent)) {
                            node.parentElement.click();
                            return true;
                        }
                    }
                    return false;
                }
                """
            )

            if not clicked:
                consecutive_no_growth += 1
                print(f"  'Load More' not found in DOM ({consecutive_no_growth}/3)")
                page.wait_for_timeout(1000)
                continue

            click_count += 1
            page.wait_for_timeout(SCROLL_PAUSE_MS + random.randint(0, 500))

            # Check if we actually got new rows
            after_batch = parse_table_rows(page)
            all_rows.update(after_batch)
            if len(all_rows) == prev_count:
                consecutive_no_growth += 1
            else:
                consecutive_no_growth = 0

        print(f"  Done — {click_count} 'Load More' clicks total.")

        ctx.close()
        browser.close()

    # Merge API-intercepted companies (de-dup by name)
    if api_companies:
        print(f"\n  API interception also captured {len(api_companies)} items")
        for item in api_companies:
            name = item.get("name", "").strip()
            if not name:
                continue
            key = item.get("id") or name
            if str(key) not in all_rows:
                all_rows[str(key)] = {
                    "source_company_id": str(key),
                    "name": name,
                    "description": item.get("description", ""),
                    "stage": item.get("stage", ""),
                    "partners": "",
                    "first_partnered": str(item.get("year", "")),
                }

    return list(all_rows.values())


def extract_year(s):
    m = re.search(r"\b(19|20)\d{2}\b", s or "")
    return int(m.group(0)) if m else None


def upsert_to_supabase(sb, companies_data):
    firm_res = sb.table("firms").upsert({"name": FIRM_NAME, "website": FIRM_WEBSITE}, on_conflict="name").execute()
    firm_id = firm_res.data[0]["id"] if firm_res.data else None
    if not firm_id:
        firm_id = sb.table("firms").select("id").eq("name", FIRM_NAME).single().execute().data["id"]

    inserted = 0
    for row in companies_data:
        company_res = (
            sb.table("companies")
            .upsert({"name": row["name"], "description": row["description"]}, on_conflict="name")
            .execute()
        )
        company_id = company_res.data[0]["id"] if company_res.data else None
        if not company_id:
            company_id = sb.table("companies").select("id").eq("name", row["name"]).single().execute().data["id"]

        sb.table("investments").upsert(
            {
                "firm_id": firm_id,
                "company_id": company_id,
                "source_company_id": row["source_company_id"],
                "stage": row["stage"],
                "first_partnered": row["first_partnered"],
                "first_partnered_year": extract_year(row["first_partnered"]),
                "partners": row["partners"],
                "source_url": URL,
            },
            on_conflict="firm_id,source_company_id",
        ).execute()
        inserted += 1

    return inserted


if __name__ == "__main__":
    sb = get_supabase()
    data = scrape_sequoia()
    print(f"\nTotal unique companies scraped: {len(data)}")

    if not data:
        print("No data scraped — check if the page structure has changed.")
        sys.exit(1)

    count = upsert_to_supabase(sb, data)
    print(f"Upserted {count} investment records for {FIRM_NAME}.")
