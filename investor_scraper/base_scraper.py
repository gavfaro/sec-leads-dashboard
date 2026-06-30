"""
Shared infrastructure for all VC firm portfolio scrapers.
"""

import os
import random
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import Page, sync_playwright
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=ROOT / ".env")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

VIEWPORTS = [
    {"width": 1440, "height": 900},
    {"width": 1920, "height": 1080},
    {"width": 1280, "height": 800},
    {"width": 1366, "height": 768},
]


def get_supabase():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        print("WARNING: using anon key — upserts may fail if RLS is enabled")
    return create_client(url, key)


def random_delay(min_s=1.5, max_s=4.0):
    time.sleep(random.uniform(min_s, max_s))


def extract_year(s):
    m = re.search(r"\b(19|20)\d{2}\b", s or "")
    return int(m.group(0)) if m else None


def new_stealth_page(browser):
    """Open a new browser context that looks like a real user."""
    viewport = random.choice(VIEWPORTS)
    ua = random.choice(USER_AGENTS)
    ctx = browser.new_context(
        viewport=viewport,
        user_agent=ua,
        locale="en-US",
        timezone_id="America/New_York",
        java_script_enabled=True,
    )
    page = ctx.new_page()
    # Remove webdriver flag that sites use to detect bots
    page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    # Block images, fonts, and media — faster load, lower fingerprint surface
    page.route(
        "**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot,mp4,mp3}",
        lambda r: r.abort(),
    )
    return page, ctx


def scroll_until_stable(page: Page, max_stalls=5, pause_min=1.5, pause_max=4.0):
    """Scroll page in human-like increments until height stops growing."""
    stalls = 0
    prev_height = 0
    while stalls < max_stalls:
        height = page.evaluate("document.body.scrollHeight")
        if height == prev_height:
            stalls += 1
        else:
            stalls = 0
        prev_height = height
        scroll_px = random.randint(500, 1100)
        page.mouse.wheel(0, scroll_px)
        page.wait_for_timeout(int(random.uniform(pause_min, pause_max) * 1000))


def upsert_firm_investments(sb, firm_name: str, firm_website: str, source_url: str, companies: list[dict]) -> int:
    """
    Upsert firm → companies → investments into Supabase.

    Each company dict must have 'name'. Optional keys:
    description, stage, partners, first_partnered, source_company_id
    """
    # Upsert firm row
    firm_res = (
        sb.table("firms")
        .upsert({"name": firm_name, "website": firm_website}, on_conflict="name")
        .execute()
    )
    firm_id = firm_res.data[0]["id"] if firm_res.data else None
    if not firm_id:
        firm_id = sb.table("firms").select("id").eq("name", firm_name).single().execute().data["id"]

    inserted = 0
    for row in companies:
        if not row.get("name"):
            continue

        # Upsert company row
        company_res = (
            sb.table("companies")
            .upsert(
                {"name": row["name"], "description": row.get("description", "")},
                on_conflict="name",
            )
            .execute()
        )
        company_id = company_res.data[0]["id"] if company_res.data else None
        if not company_id:
            company_id = (
                sb.table("companies").select("id").eq("name", row["name"]).single().execute().data["id"]
            )

        # Use company name as source_company_id when firm has no internal numeric ID
        source_id = row.get("source_company_id") or row["name"]

        sb.table("investments").upsert(
            {
                "firm_id": firm_id,
                "company_id": company_id,
                "source_company_id": source_id,
                "stage": row.get("stage", ""),
                "first_partnered": row.get("first_partnered", ""),
                "first_partnered_year": extract_year(row.get("first_partnered", "")),
                "partners": row.get("partners", ""),
                "source_url": source_url,
            },
            on_conflict="firm_id,source_company_id",
        ).execute()
        inserted += 1

    return inserted
