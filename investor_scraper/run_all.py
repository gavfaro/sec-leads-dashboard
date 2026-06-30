"""
Orchestrate scraping of all configured VC firms.

Usage:
    # Scrape every firm with a portfolio_url
    python run_all.py

    # Scrape specific firms (substring match on name, case-insensitive)
    python run_all.py --firms "a16z" "accel" "index"

    # Dry-run: list which firms would be scraped
    python run_all.py --list

Between firms the script waits 45–120 seconds to avoid hammering sites.
"""

import argparse
import random
import sys
import time
from pathlib import Path

# Make sibling imports work regardless of cwd
sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.sync_api import sync_playwright

from base_scraper import get_supabase, random_delay, upsert_firm_investments
from firms_config import FIRMS
from generic_scraper import scrape_firm_portfolio

INTER_FIRM_DELAY_MIN = 45   # seconds between firms
INTER_FIRM_DELAY_MAX = 120


def parse_args():
    p = argparse.ArgumentParser(description="Scrape VC portfolio pages into Supabase")
    p.add_argument("--firms", nargs="+", metavar="NAME",
                   help="Scrape only firms whose name contains this substring (case-insensitive)")
    p.add_argument("--list", action="store_true",
                   help="List firms that would be scraped and exit")
    return p.parse_args()


def select_firms(filter_names: list[str] | None) -> list[dict]:
    runnable = [f for f in FIRMS if f.get("portfolio_url")]
    if not filter_names:
        return runnable
    filters = [n.lower() for n in filter_names]
    return [f for f in runnable if any(fil in f["name"].lower() for fil in filters)]


def main():
    args = parse_args()
    firms = select_firms(args.firms)

    skipped = [f for f in FIRMS if not f.get("portfolio_url")]
    print(f"\n{'='*60}")
    print(f"  Firms to scrape  : {len(firms)}")
    print(f"  Skipped (no URL) : {len(skipped)}")
    if skipped:
        print("  Skipped firms    : " + ", ".join(f["name"] for f in skipped))
    print(f"{'='*60}\n")

    if args.list:
        for f in firms:
            print(f"  {f['name']:<40} {f['portfolio_url']}")
        return

    if not firms:
        print("No firms matched. Use --list to see available firms.")
        sys.exit(1)

    sb = get_supabase()
    total_companies = 0
    failed = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for i, firm in enumerate(firms):
            print(f"\n[{i+1}/{len(firms)}] {firm['name']}")
            if firm.get("notes"):
                print(f"  note: {firm['notes']}")

            companies = scrape_firm_portfolio(browser, firm)

            if companies:
                count = upsert_firm_investments(
                    sb,
                    firm_name=firm["name"],
                    firm_website=firm.get("website", ""),
                    source_url=firm["portfolio_url"],
                    companies=companies,
                )
                print(f"  → Upserted {count} records for {firm['name']}")
                total_companies += count
            else:
                failed.append(firm["name"])

            # Polite pause between firms (skip after last one)
            if i < len(firms) - 1:
                wait = random.uniform(INTER_FIRM_DELAY_MIN, INTER_FIRM_DELAY_MAX)
                print(f"  zzz Waiting {wait:.0f}s before next firm...")
                time.sleep(wait)

        browser.close()

    print(f"\n{'='*60}")
    print(f"  Done. Total records upserted: {total_companies}")
    if failed:
        print(f"  Failed / 0 results  : {', '.join(failed)}")
        print("  These firms may need custom scrapers — check their portfolio pages manually.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
