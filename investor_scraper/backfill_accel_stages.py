"""
Backfill investment_stage and acquired_by for existing Accel portfolio data.

We already fetched all company pages during the initial scrape but didn't capture
stage or acquired_by. This script re-fetches each Accel company page and updates:
  - portfolio_investments.investment_stage  (e.g. "Seed", "Series A")
  - contact_investments.relationship        ("previous" if acquired, else leave "current")
  - contact_investments.exit_note           ("Acquired by X" if applicable)

Slug heuristic: Accel company slugs are generally just the company name lowercased
with spaces replaced by hyphens. For companies where that 404s, we log and skip.

Run: python investor_scraper/backfill_accel_stages.py [--dry-run] [--limit N]
"""
import argparse
import logging
import os
import re
import time
from pathlib import Path

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("backfill")

CRAWL_DELAY = 10


def _name_to_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = slug.strip("-")
    return slug


def _fetch_accel(url: str) -> str:
    from playwright.sync_api import sync_playwright
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    )
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="load", timeout=90000)
        page.wait_for_timeout(5000)
        html = page.content()
        ctx.close()
        browser.close()
    return html


def _parse_company_page(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    stage: str | None = None
    year: str | None = None
    acquired_by: str | None = None

    for label_p in soup.find_all("p", class_=lambda c: c and "leading-accel-tag" in c):
        label = label_p.get_text(strip=True).lower()
        value_el = label_p.find_next_sibling()
        if not value_el:
            continue

        if "initial investment" in label:
            spans = value_el.find_all("span", recursive=False)
            if spans:
                first_text = spans[0].get_text(strip=True)
                if re.match(r"^\d{4}$", first_text):
                    year = first_text
                else:
                    stage = first_text.capitalize() or None
                    if len(spans) > 1:
                        m = re.search(r"\d{4}", spans[1].get_text(strip=True))
                        year = m.group(0) if m else None

        elif "acquired" in label:
            raw = value_el.get_text(" ", strip=True)
            acquired_by = re.sub(r"^by\s+", "", raw, flags=re.IGNORECASE).strip() or None

    # Detect 404 / wrong page: Accel 404 pages have no leading-accel-tag elements
    # and no h1 with meaningful text — if stage/acquired_by are both None and there's
    # no description h1, treat as a miss.
    h1 = soup.find("h1")
    h1_text = h1.get_text(strip=True) if h1 else ""
    page_ok = bool(stage or acquired_by or h1_text)

    return {"stage": stage, "year": year, "acquired_by": acquired_by, "page_ok": page_ok}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    opts = ap.parse_args()

    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    # Get Accel org id
    org_res = sb.table("organizations").select("id").eq("name", "Accel").execute()
    if not org_res.data:
        log.error("Accel org not found in DB")
        return
    org_id = org_res.data[0]["id"]

    # Fetch all Accel portfolio companies
    pi_res = (
        sb.table("portfolio_investments")
        .select("id, company_id, investment_stage, year_partnered, companies(id, name)")
        .eq("org_id", org_id)
        .limit(5000)
        .execute()
    )
    # Only process rows where both fields are still NULL
    rows_all = pi_res.data
    rows = [r for r in rows_all if not r.get("investment_stage") or not r.get("year_partnered")]
    log.info("Total Accel portfolio rows: %d, need backfill: %d", len(rows_all), len(rows))
    if opts.limit:
        rows = rows[: opts.limit]

    log.info(
        "Found %d Accel portfolio_investments with NULL stage%s",
        len(rows),
        " [DRY-RUN]" if opts.dry_run else "",
    )

    updated = skipped = failed = 0

    for i, row in enumerate(rows):
        company = row.get("companies") or {}
        name = company.get("name", "")
        company_id = row["company_id"]
        pi_id = row["id"]

        slug = _name_to_slug(name)
        url = f"https://www.accel.com/companies/{slug}"
        log.info("[%d/%d] %s → %s", i + 1, len(rows), name, url)

        try:
            html = _fetch_accel(url)
            parsed = _parse_company_page(html)

            if not parsed["page_ok"]:
                log.warning("  404 or empty page — trying without suffix")
                # Some slugs have a different canonical. Skip rather than guess further.
                skipped += 1
                time.sleep(CRAWL_DELAY)
                continue

            stage = parsed["stage"]
            acquired_by = parsed["acquired_by"]
            year = parsed["year"]
            log.info(
                "  stage=%r  year=%r  acquired_by=%r",
                stage, year, acquired_by,
            )

            if opts.dry_run:
                updated += 1
                time.sleep(CRAWL_DELAY)
                continue

            # Update portfolio_investments.investment_stage and year_partnered
            pi_updates = {}
            if stage:
                pi_updates["investment_stage"] = stage
            if year:
                pi_updates["year_partnered"] = int(year)
            if pi_updates:
                sb.table("portfolio_investments").update(pi_updates).eq("id", pi_id).execute()

            # Update contact_investments for this company
            if acquired_by:
                exit_note = f"Acquired by {acquired_by}"
                ci_rows = (
                    sb.table("contact_investments")
                    .select("id, contact_id, relationship")
                    .eq("company_id", company_id)
                    .execute()
                    .data
                )
                for ci in ci_rows:
                    # Only update contacts who belong to Accel (cross-check via contacts table)
                    contact_res = (
                        sb.table("contacts")
                        .select("org_id")
                        .eq("id", ci["contact_id"])
                        .execute()
                    )
                    if contact_res.data and contact_res.data[0]["org_id"] != org_id:
                        continue
                    sb.table("contact_investments").update(
                        {"relationship": "previous", "exit_note": exit_note}
                    ).eq("id", ci["id"]).execute()

            updated += 1
        except Exception:
            log.exception("  failed, skipping")
            failed += 1

        time.sleep(CRAWL_DELAY)

    log.info(
        "Done. updated=%d  skipped=%d  failed=%d%s",
        updated, skipped, failed,
        " [DRY-RUN]" if opts.dry_run else "",
    )


if __name__ == "__main__":
    main()
