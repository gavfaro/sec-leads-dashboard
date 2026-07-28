import io
import json as _json
import logging
import os
import re
import sys
import time
import urllib.request
from urllib.parse import urlparse

import pdfplumber
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import Client, create_client

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("scraper")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
CRAWL_DELAY_SECONDS = 10  # honors greylock.com/robots.txt Crawl-delay: 10


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env. "
            "The anon key cannot write to organizations/contacts because RLS is enabled."
        )
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Firm-specific parsers
# Each parser takes rendered page HTML and returns a list of dicts:
#   {name, website, description, stage, status, domain, investors: [str, ...]}
# ---------------------------------------------------------------------------

def _clean_logo_name(alt_text: str) -> str:
    return re.sub(r"\s+Logo(\s+Grey)?\s*$", "", alt_text, flags=re.IGNORECASE).strip()


def _slug_to_name(slug: str) -> str:
    return slug.removesuffix("-div").replace("-", " ").strip().title()


def parse_greylock(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    companies = []

    for card in soup.select("div.companies-box"):
        img = card.select_one(".logo-area img")
        alt = img.get("alt") if img else None
        name = _clean_logo_name(alt) if alt else None
        if not name:
            card_id = card.get("id", "")
            name = _slug_to_name(card_id) if card_id else None

        desc_el = card.select_one(".mobile-text p") or card.select_one(".desc-area p")
        description = desc_el.get_text(strip=True) if desc_el else None

        domain = None
        for box in card.select(".info-text .text-box"):
            h5 = box.select_one("h5")
            if h5 and h5.get_text(strip=True) == "DOMAIN":
                p = box.select_one("p")
                domain = p.get_text(strip=True) if p else None

        stage_el = card.select_one(".partnered-area p")
        stage = stage_el.get_text(strip=True) if stage_el else None
        if stage in ("-", ""):
            stage = None

        status_el = card.select_one(".status-area p")
        status = status_el.get_text(strip=True) if status_el else None

        investors_el = card.select_one(".investors-area p")
        investors = (
            [n.strip() for n in investors_el.get_text(strip=True).split(",") if n.strip()]
            if investors_el
            else []
        )

        website = None
        for a in card.select(".social-link a"):
            href = a.get("href", "")
            if href and "twitter.com" not in href and "x.com" not in href and "linkedin.com" not in href:
                website = href
                break

        companies.append(
            {
                "name": name,
                "website": website,
                "description": description,
                "stage": stage,
                "status": status,
                "domain": domain,
                "investors": investors,
            }
        )

    return companies


# ---------------------------------------------------------------------------
# Sequoia — portfolio page
# ---------------------------------------------------------------------------
# Confirmed table column structure (from live site inspection):
#   DOM col 0: hidden numeric ID (not rendered in UI — BS4 sees it, JS innerText skips it)
#   DOM col 1: COMPANY NAME  (may contain hidden sub-elements → take first line only)
#   DOM col 2: SHORT DESCRIPTION
#   DOM col 3: CURRENT STAGE  (e.g. "Pre-Seed/Seed", "Growth", "IPO")
#   DOM col 4: PARTNERS       (Sequoia partner name(s))
#   DOM col 5: FIRST PARTNERED (e.g. "Pre-Seed/Seed (2023)")
# Expanded detail rows have only 1 <td> (colspan) — len(cells) check skips them.

def parse_sequoia(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        log.warning("parse_sequoia: no <table> found — page structure may have changed")
        return []

    companies = []
    seen: set[str] = set()

    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        # Need at least 5 tds (id, desc, stage, partners, first_partnered)
        if len(tds) < 5:
            continue

        cells = [td.get_text(separator="\n", strip=True) for td in tds]

        # td[0] is a numeric row ID — skip non-data rows
        if not cells[0].isdigit():
            continue

        # Company name lives in a <th> within the data row (not a <td>)
        th = tr.find("th")
        name = th.get_text(strip=True) if th else ""
        if not name or name in seen:
            continue
        seen.add(name)

        # td[1] = SHORT DESCRIPTION
        # td[2] = CURRENT STAGE
        # td[3] = PARTNERS (may be multi-line: "Name1\nName2")
        # td[4] = FIRST PARTNERED (e.g. "Early (2003)")
        # td[5] = Collapse button text — ignore
        description   = cells[1].strip() or None
        stage         = cells[2].strip() or None
        raw_partners  = cells[3].strip()
        # first_partnered not stored in schema but keep for debugging
        # cells[4] = "Stage (Year)"

        investors = [n.strip() for n in re.split(r"[,\n]+", raw_partners) if n.strip()]

        # cells[4] = "Stage (Year)" e.g. "Pre-Seed/Seed (2023)" or "Early (2021)"
        year_match = re.search(r"\((\d{4})\)", cells[4]) if len(cells) > 4 else None
        year_partnered = int(year_match.group(1)) if year_match else None

        companies.append({
            "name": name,
            "website": None,
            "description": description,
            "stage": stage,
            "year_partnered": year_partnered,
            "status": None,
            "domain": None,
            "investors": investors,
        })

    return companies


def _click_load_more(page) -> bool:
    """Click a visible 'Load More' button via JS text-node walk. Returns True if clicked."""
    return page.evaluate(
        """
        () => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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


def fetch_with_load_more(url: str, row_selector: str = "table tr") -> str:
    """
    Fetch a page with Playwright, clicking 'Load More' until the button disappears
    or the row count stops growing. Works for both the portfolio page and partner profiles.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)

        for btn_text in ["Accept", "Accept all", "I agree", "Got it"]:
            try:
                page.click(f"text={btn_text}", timeout=1500)
                break
            except Exception:
                pass

        stalls = 0
        prev_count = 0
        while stalls < 3:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(600)
            if not _click_load_more(page):
                stalls += 1
                page.wait_for_timeout(1000)
                continue
            page.wait_for_timeout(2000)
            count = page.locator(row_selector).count()
            if count == prev_count:
                stalls += 1
            else:
                stalls = 0
                log.info("  %d rows loaded (%s)", count, url.split("//")[-1][:40])
            prev_count = count

        html = page.content()
        ctx.close()
        browser.close()
    return html


# ---------------------------------------------------------------------------
# Sequoia — team pages
# ---------------------------------------------------------------------------

SEQUOIA_TEAM_BASE = "https://sequoiacap.com/our-team/"
# Maps URL role param → human-readable label stored in contacts.role
SEQUOIA_TEAM_URLS = [
    (SEQUOIA_TEAM_BASE + "?_role=seed-early", "Seed/Early Investor"),
    (SEQUOIA_TEAM_BASE + "?_role=growth",      "Growth Investor"),
    (SEQUOIA_TEAM_BASE + "?_role=operator",    "Operator"),
]


def _parse_sequoia_team_listing(html: str) -> list[str]:
    """Return /people/<slug>/ profile URLs from a team listing page."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    urls = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/people/" in href and re.search(r"/people/[\w-]+/", href):
            if href.startswith("/"):
                href = "https://sequoiacap.com" + href
            if href not in seen:
                seen.add(href)
                urls.append(href)
    return urls


def _parse_sequoia_partner_profile(html: str) -> dict:
    """
    Parse a Sequoia partner profile page.
    Returns name, bio, linkedin_url, other_sites, email,
    current_companies and previous_companies as lists of {name, description} dicts.

    Company tables use the same <th>/<td> structure as the main portfolio table:
      <th>  = COMPANY NAME
      td[0] = numeric row ID
      td[1] = SHORT DESCRIPTION
      td[2] = CURRENT STAGE
      td[3] = FOUNDERS  (startup founders, not Sequoia partners)
      td[4] = FIRST PARTNERED
    """
    soup = BeautifulSoup(html, "html.parser")

    # Name — h1 on the page
    name = ""
    h1 = soup.find("h1")
    if h1:
        name = re.sub(r"\s+", " ", h1.get_text(strip=True)).strip()

    # Social links
    linkedin_url = None
    other_sites: dict = {}
    email = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "linkedin.com/in/" in href:
            linkedin_url = href
        elif href.startswith("mailto:"):
            email = href.removeprefix("mailto:")
        elif "twitter.com" in href or "x.com" in href:
            other_sites["twitter"] = href

    # Bio — BACKSTORY section
    bio = None
    for heading in soup.find_all(["h2", "h3", "h4", "p", "div"]):
        if "backstory" in heading.get_text(strip=True).lower():
            parts = []
            for sib in heading.find_next_siblings(["p", "div"]):
                text = sib.get_text(" ", strip=True)
                if not text or len(text) < 20:
                    continue
                if sib.find(["h2", "h3", "h4"]):
                    break
                parts.append(text)
                if len(parts) >= 4:
                    break
            if parts:
                bio = " ".join(parts)
                break

    # Company tables — profile pages use <section> elements with <h3> headings:
    #   "Current Companies"  → relationship = "current"
    #   "Enduring Companies" → relationship = "previous"  (acquired/exited)
    # Each data row: <th scope="row"> = company name, first <td> = description.
    # No numeric ID column here (unlike the main portfolio table).
    current_companies: list[dict] = []
    previous_companies: list[dict] = []

    for section in soup.find_all("section"):
        h3 = section.find("h3", recursive=False)
        if not h3:
            continue
        heading = h3.get_text(strip=True).lower()
        if "current" in heading:
            target = current_companies
        elif "enduring" in heading or "previous" in heading:
            target = previous_companies
        else:
            continue  # bio / other sections

        table = section.find("table")
        if not table:
            continue

        for tr in table.find_all("tr"):
            th = tr.find("th", attrs={"scope": "row"})
            if not th:
                continue
            company_name = th.get_text(strip=True)
            if not company_name:
                continue
            tds = tr.find_all("td")
            description = tds[0].get_text(strip=True) or None if tds else None
            target.append({"name": company_name, "description": description})

    return {
        "name": name,
        "bio": bio,
        "email": email,
        "linkedin_url": linkedin_url,
        "other_sites": other_sites or None,
        "current_companies": current_companies,
        "previous_companies": previous_companies,
    }


def scrape_sequoia_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Sequoia team profiles as the sole source of data.

    For each partner: store contact info, then store their personal deal history as
    contact_investments. Also create portfolio_investments (org-level) from the same
    data so the firm→company link exists. Companies without a named partner are skipped.
    """
    firm = FIRM_REGISTRY["sequoia"]
    if dry_run:
        org_id = "[DRY-RUN]"
    else:
        org_id = get_or_create_organization(sb, firm["name"], firm["entity_type"], firm.get("website"))

    # Collect (profile_url, role_label) pairs from all three listing pages.
    # Role label comes from the listing category, not the profile page.
    profile_entries: list[tuple[str, str]] = []
    seen_urls: set[str] = set()
    for team_url, role_label in SEQUOIA_TEAM_URLS:
        log.info("Fetching team listing: %s", team_url)
        html = fetch_rendered_html(team_url)
        for url in _parse_sequoia_team_listing(html):
            if url not in seen_urls:
                seen_urls.add(url)
                profile_entries.append((url, role_label))
        time.sleep(CRAWL_DELAY_SECONDS)

    if limit:
        profile_entries = profile_entries[:limit]
    log.info("Processing %d partner profiles%s", len(profile_entries), " [DRY-RUN]" if dry_run else "")

    for i, (profile_url, role_label) in enumerate(profile_entries):
        try:
            log.info("[%d/%d] %s", i + 1, len(profile_entries), profile_url)
            # Profile page tables use data-paging="false" — all rows render at once
            html = fetch_rendered_html(profile_url)
            p = _parse_sequoia_partner_profile(html)

            if not p["name"]:
                log.warning("  no name found, skipping")
                continue

            if dry_run:
                log.info("  [DRY-RUN] %s (%s): bio=%s linkedin=%s — %d current / %d previous",
                         p["name"], role_label, bool(p["bio"]), bool(p["linkedin_url"]),
                         len(p["current_companies"]), len(p["previous_companies"]))
                for c in p["current_companies"]:
                    log.info("    CURRENT  %r — %r", c["name"], c["description"])
                for c in p["previous_companies"]:
                    log.info("    PREVIOUS %r — %r", c["name"], c["description"])
            else:
                contact_id = get_or_create_contact(sb, org_id, p["name"])
                update_contact_profile(
                    sb, contact_id,
                    bio=p["bio"],
                    email=p["email"],
                    role=role_label,
                    linkedin_url=p["linkedin_url"],
                    other_sites=p["other_sites"],
                )
                for rel, companies in [("current", p["current_companies"]), ("previous", p["previous_companies"])]:
                    for c in companies:
                        company_id = upsert_company(sb, c["name"], None, c["description"])
                        get_or_create_contact_investment(sb, contact_id, company_id, rel, None)
                        get_or_create_portfolio_investment(sb, org_id, company_id, None)

                log.info(
                    "  %s (%s): bio=%s linkedin=%s — %d current / %d previous companies",
                    p["name"], role_label, bool(p["bio"]), bool(p["linkedin_url"]),
                    len(p["current_companies"]), len(p["previous_companies"]),
                )

        except Exception:
            log.exception("  failed, skipping")

        time.sleep(CRAWL_DELAY_SECONDS)


# ---------------------------------------------------------------------------
# Accel — team pages
# ---------------------------------------------------------------------------
# Accel's site never reaches networkidle (long-polling telemetry), so we use
# wait_until="load" + a fixed post-load wait instead of fetch_rendered_html.

def _fetch_accel(url: str) -> str:
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


def _parse_accel_team_listing(html: str) -> list[str]:
    """Return /team/<slug> profile URLs from the Accel team page (Global tab is default)."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    urls: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.match(r"^/team/[\w-]+$", href) and href not in seen:
            seen.add(href)
            urls.append(href)
    return urls


def _parse_accel_partner_profile(html: str) -> dict:
    """
    Parse an Accel partner profile page.

    Left panel:
      <h1>                          → name
      <p class="leading-accel-tag"> Specialty </p> → next sibling div → role
      <p class="leading-accel-tag"> Based in  </p> → next sibling <p> → location
      <a aria-label="LinkedIn">     → linkedin_url  (personal /in/ links only)
      <a aria-label="Twitter|X">    → twitter

    Right panel:
      <h2>About {Name}</h2>         → next sibling div → first <p> → bio
      <p class="leading-accel-tag"> Relationships </p>
        → parent div → <a href="/companies/..."> → <img alt="Name logo"> → company name
        Stealth entries are <button> elements, not <a>, so they're naturally skipped.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Name
    name = ""
    h1 = soup.find("h1")
    if h1:
        name = re.sub(r"\s+", " ", h1.get_text(strip=True)).strip()

    # Role (Specialty) and location (Based in)
    role: str | None = None
    location: str | None = None
    for label_p in soup.find_all("p", class_=lambda c: c and "leading-accel-tag" in c):
        label = label_p.get_text(strip=True).lower()
        value_el = label_p.find_next_sibling()
        if not value_el:
            continue
        value = value_el.get_text(" ", strip=True).strip() or None
        if "specialty" in label:
            role = value
        elif "based in" in label:
            location = value

    # Bio — first <p> after the "About <Name>" h2
    bio: str | None = None
    for h2 in soup.find_all("h2"):
        if h2.get_text(" ", strip=True).startswith("About "):
            sib = h2.find_next_sibling()
            if sib:
                first_p = sib.find("p")
                if first_p:
                    bio = first_p.get_text(" ", strip=True) or None
            break

    # Social links — use aria-label to target personal profiles, not Accel's company pages
    linkedin_url: str | None = None
    twitter_url: str | None = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        label = (a.get("aria-label") or "").lower()
        if label == "linkedin" and "linkedin.com/in/" in href:
            linkedin_url = href
        elif label in ("twitter", "x") and ("twitter.com/" in href or "x.com/" in href):
            if not href.rstrip("/").endswith("/accel"):  # exclude @accel footer link
                twitter_url = href

    other_sites: dict = {}
    if twitter_url:
        other_sites["twitter"] = twitter_url
    if location:
        other_sites["location"] = location

    # Companies from Relationships section
    # <p class="leading-accel-tag">Relationships</p> → parent → <a href="/companies/...">
    # Each entry includes the slug so scrape_accel_team can fetch the company page for description.
    companies: list[dict] = []
    for label_p in soup.find_all("p", class_=lambda c: c and "leading-accel-tag" in c):
        if "relationship" in label_p.get_text(strip=True).lower():
            container = label_p.parent
            for a in container.find_all("a", href=True):
                href = a["href"]
                if not href.startswith("/companies/"):
                    continue
                co_slug = href.split("/companies/")[-1].rstrip("/")
                img = a.find("img")
                if not img:
                    continue
                alt = img.get("alt", "").strip()
                # Strip " logo" suffix (present on some, absent on others e.g. "Tolmo")
                company_name = re.sub(r"\s+logo\s*$", "", alt, flags=re.IGNORECASE).strip()
                if not company_name:
                    # Fall back to slug: /companies/periodic-labs → "Periodic Labs"
                    company_name = co_slug.replace("-", " ").title()
                if company_name:
                    companies.append({"name": company_name, "slug": co_slug})
            break

    return {
        "name": name,
        "bio": bio,
        "role": role,
        "location": location,
        "linkedin_url": linkedin_url,
        "other_sites": other_sites or None,
        "companies": companies,
    }


def _parse_accel_company_page(html: str) -> dict:
    """
    Parse an Accel company page (https://www.accel.com/companies/<slug>).

    <h1><p>Next-gen Python tooling</p></h1>         → description (tagline)
    <a aria-label="Website" href="...">              → website
    <p "leading-accel-tag">Initial Investment</p>
      → next span → first <span> = stage, second <span> = " in 2022" → year
    <p "leading-accel-tag">Acquired</p>
      → next span → text = "by OpenAI" → acquired_by = "OpenAI"
    """
    soup = BeautifulSoup(html, "html.parser")

    description: str | None = None
    h1 = soup.find("h1")
    if h1:
        inner_p = h1.find("p")
        text = (inner_p or h1).get_text(" ", strip=True)
        description = text or None

    website: str | None = None
    for a in soup.find_all("a", href=True):
        if (a.get("aria-label") or "").lower() == "website":
            href = a["href"]
            if href.startswith("http"):
                website = href
                break

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
                _STAGE_NORMALIZE = {
                    "seed": "Seed", "pre-seed": "Pre-Seed", "growth": "Growth",
                    "series a": "Series A", "series b": "Series B",
                    "series c": "Series C", "series d": "Series D", "series e": "Series E",
                }
                if re.match(r"^\d{4}$", first_text):
                    # Year-only format (older pages)
                    year = first_text
                elif re.match(r"^\d{2}/\d{2}/\d{4}$", first_text):
                    # Date format MM/DD/YYYY — extract year, no stage
                    year = first_text[-4:]
                else:
                    stage = _STAGE_NORMALIZE.get(first_text.lower(), first_text.title()) or None
                    if len(spans) > 1:
                        m = re.search(r"\d{4}", spans[1].get_text(strip=True))
                        year = m.group(0) if m else None

        elif "acquired" in label:
            raw = value_el.get_text(" ", strip=True)
            acquired_by = re.sub(r"^by\s+", "", raw, flags=re.IGNORECASE).strip() or None

    return {
        "description": description,
        "website": website,
        "stage": stage,
        "year": year,
        "acquired_by": acquired_by,
    }


def scrape_accel_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Accel team profiles.

    Two-phase approach:
      Phase 1 — fetch all partner profile pages, collect (partner data, company slugs)
      Phase 2 — fetch each unique company page once to get description + website
      Phase 3 — write everything to DB

    This avoids re-fetching a company that appears on multiple partners' pages.
    Accel doesn't distinguish current vs previous investments — all stored as "current".
    Location is stored in contact other_sites["location"].
    """
    org_name = "Accel"
    org_website = "https://www.accel.com"
    entity_type = "Multi-Stage VC"

    # ── Phase 1: collect all partner profiles ────────────────────────────────
    log.info("Fetching Accel team listing")
    listing_html = _fetch_accel("https://www.accel.com/team")
    profile_slugs = _parse_accel_team_listing(listing_html)
    if limit:
        profile_slugs = profile_slugs[:limit]
    log.info("Found %d profiles%s", len(profile_slugs), " [DRY-RUN]" if dry_run else "")

    all_profiles: list[dict] = []
    for i, slug in enumerate(profile_slugs):
        profile_url = f"https://www.accel.com{slug}"
        try:
            log.info("[%d/%d] Fetching partner profile %s", i + 1, len(profile_slugs), profile_url)
            html = _fetch_accel(profile_url)
            p = _parse_accel_partner_profile(html)
            if not p["name"]:
                log.warning("  no name found, skipping")
            else:
                log.info("  %s | role=%r | %d companies", p["name"], p["role"], len(p["companies"]))
                all_profiles.append(p)
        except Exception:
            log.exception("  failed, skipping")
        time.sleep(CRAWL_DELAY_SECONDS)

    # ── Phase 2: fetch each unique company page once ──────────────────────────
    # Collect unique slugs preserving first-seen order
    seen_slugs: set[str] = set()
    unique_companies: list[dict] = []  # {name, slug}
    for p in all_profiles:
        for c in p["companies"]:
            if c["slug"] not in seen_slugs:
                seen_slugs.add(c["slug"])
                unique_companies.append(c)

    log.info("Fetching %d unique company pages%s", len(unique_companies), " [DRY-RUN]" if dry_run else "")

    # company_cache: slug → {name, description, website}
    company_cache: dict[str, dict] = {}
    for i, c in enumerate(unique_companies):
        company_url = f"https://www.accel.com/companies/{c['slug']}"
        try:
            log.info("[%d/%d] %s", i + 1, len(unique_companies), company_url)
            if dry_run:
                # Don't fetch in dry-run; just record the slug
                company_cache[c["slug"]] = {"name": c["name"], "description": None, "website": None}
            else:
                html = _fetch_accel(company_url)
                co_data = _parse_accel_company_page(html)
                company_cache[c["slug"]] = {
                    "name": c["name"],
                    "description": co_data["description"],
                    "website": co_data["website"],
                }
                log.info("  desc=%r  website=%s", co_data["description"], bool(co_data["website"]))
        except Exception:
            log.exception("  failed, using name-only fallback")
            company_cache[c["slug"]] = {"name": c["name"], "description": None, "website": None}
        if not dry_run:
            time.sleep(CRAWL_DELAY_SECONDS)

    # ── Phase 3: write to DB (or log in dry-run) ─────────────────────────────
    if dry_run:
        log.info("[DRY-RUN] Would write %d partners and %d companies to DB",
                 len(all_profiles), len(unique_companies))
        for p in all_profiles:
            log.info("  PARTNER %s | role=%r | location=%r | bio=%s | linkedin=%s | %d companies",
                     p["name"], p["role"], p["location"],
                     bool(p["bio"]), bool(p["linkedin_url"]), len(p["companies"]))
            for c in p["companies"]:
                co = company_cache.get(c["slug"], c)
                log.info("    COMPANY %r (desc=%s website=%s)",
                         co["name"], bool(co.get("description")), bool(co.get("website")))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)
    for p in all_profiles:
        try:
            contact_id = get_or_create_contact(sb, org_id, p["name"])
            update_contact_profile(
                sb, contact_id,
                bio=p["bio"],
                email=None,
                role=p["role"],
                linkedin_url=p["linkedin_url"],
                other_sites=p["other_sites"],
            )
            for c in p["companies"]:
                co = company_cache.get(c["slug"], {"name": c["name"], "description": None, "website": None, "stage": None, "acquired_by": None})
                company_id = upsert_company(sb, co["name"], co.get("website"), co.get("description"))
                acquired_by = co.get("acquired_by")
                relationship = "previous" if acquired_by else "current"
                exit_note = f"Acquired by {acquired_by}" if acquired_by else None
                get_or_create_contact_investment(sb, contact_id, company_id, relationship, exit_note)
                year = int(co["year"]) if co.get("year") else None
                get_or_create_portfolio_investment(sb, org_id, company_id, co.get("stage"), year)
            log.info("Wrote %s: %d companies", p["name"], len(p["companies"]))
        except Exception:
            log.exception("Failed writing %r, skipping", p.get("name"))


# ---------------------------------------------------------------------------
# Y Combinator — partners + companies directory
# ---------------------------------------------------------------------------

def _fetch_yc(url: str) -> str:
    """Fetch a YC page with networkidle wait and stealth."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)
        html = page.content()
        ctx.close()
        browser.close()
    return html


def _parse_yc_partners_listing(html: str) -> list[str]:
    """Return absolute profile URLs from the /partners grid."""
    soup = BeautifulSoup(html, "html.parser")
    container = soup.find(class_="partners-grid-container")
    if not container:
        log.warning("_parse_yc_partners_listing: partners-grid-container not found")
        return []
    seen: set[str] = set()
    urls: list[str] = []
    for a in container.find_all("a", href=True):
        href = a["href"]
        if "/people/" in href and href not in seen:
            seen.add(href)
            urls.append("https://www.ycombinator.com" + href)
    return urls


def _parse_yc_partner_profile(html: str) -> dict | None:
    """
    Extract partner data from the JSON blob embedded in data-page on profile pages.

    YC partner profiles embed everything in:
      <div id="PartnerPage-react-component-..." data-page="{...}">

    Returns: {name, bio, twitter, linkedin, companies: [{name, url}]}
    """
    soup = BeautifulSoup(html, "html.parser")
    for div in soup.find_all("div", attrs={"data-page": True}):
        raw = div.get("data-page", "")
        if not raw:
            continue
        try:
            data = _json.loads(raw)
        except _json.JSONDecodeError:
            continue
        if data.get("component") == "PartnerPage":
            partner = data.get("props", {}).get("partner", {})
            return {
                "name": partner.get("name"),
                "bio": partner.get("bio"),
                "twitter": partner.get("twitter_handle"),
                "linkedin": partner.get("linkedin_handle"),
                "companies": [
                    {"name": c["name"], "url": (c.get("url") or "").strip()}
                    for c in partner.get("companies", [])
                    if c.get("name")
                ],
            }
    return None


def _get_yc_algolia_creds() -> tuple[str, str, str]:
    """
    Open the YC companies page and intercept the Algolia API request.

    YC passes credentials as URL query params (x-algolia-application-id,
    x-algolia-api-key), not in request headers. The index name comes from
    the POST body's indexName field.
    """
    import urllib.parse as _uparse
    creds: dict[str, str] = {}

    def on_request(request):
        if "algolia.net" in request.url and "algolia-application-id" in request.url and "app_id" not in creds:
            parsed = _uparse.urlparse(request.url)
            params = _uparse.parse_qs(parsed.query)
            app_id = (params.get("x-algolia-application-id") or [""])[0]
            api_key = (params.get("x-algolia-api-key") or [""])[0]
            if app_id and api_key:
                creds["app_id"] = app_id
                creds["api_key"] = api_key
                # Extract index name from POST body JSON
                try:
                    body = _json.loads(request.post_data or "{}")
                    idx = body.get("requests", [{}])[0].get("indexName", "YCCompany_production")
                    creds["index"] = idx
                except Exception:
                    creds["index"] = "YCCompany_production"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.on("request", on_request)
        page.goto("https://www.ycombinator.com/companies", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        ctx.close()
        browser.close()

    if "app_id" not in creds:
        raise RuntimeError("Could not capture Algolia credentials from YC companies page")
    log.info("Algolia: app_id=%s index=%s", creds["app_id"], creds["index"])
    return creds["app_id"], creds["api_key"], creds["index"]


def _query_yc_algolia(app_id: str, api_key: str, index: str, page_num: int = 0) -> dict:
    """
    Query a single page of YC companies from Algolia.

    YC uses the multi-index endpoint (/indexes/*/queries) with credentials
    as URL query params and the index name in the POST body.
    """
    import urllib.parse as _uparse
    params = _uparse.urlencode({
        "x-algolia-agent": "Algolia for JavaScript (3.35.1); Browser",
        "x-algolia-application-id": app_id,
        "x-algolia-api-key": api_key,
    })
    url = f"https://{app_id.lower()}-dsn.algolia.net/1/indexes/*/queries?{params}"
    inner_params = _uparse.urlencode({
        "query": "",
        "page": page_num,
        "hitsPerPage": 1000,
        "tagFilters": "",
    })
    payload = _json.dumps({
        "requests": [{"indexName": index, "params": inner_params}]
    }).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        multi = _json.loads(resp.read())
    return multi.get("results", [{}])[0]


def _batch_to_year(batch: str | None) -> int | None:
    """Convert YC batch code (W24, S23, IK) to a 4-digit year, or None."""
    if not batch:
        return None
    m = re.search(r"(\d{2,4})", batch)
    if not m:
        return None
    year = int(m.group(1))
    if year < 100:
        year += 2000
    return year if 2005 <= year <= 2030 else None


def scrape_yc_partners(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape YC /partners page and each partner's profile.

    Phase 1 — fetch /partners grid → collect /people/<slug> URLs
    Phase 2 — fetch each profile → parse embedded JSON blob
    Phase 3 — write YC org, contacts (partners), companies, contact_investments,
               portfolio_investments to DB
    """
    org_name = "Y Combinator"
    org_website = "https://www.ycombinator.com"
    entity_type = "Accelerator"

    log.info("Fetching YC partners listing")
    html = _fetch_yc("https://www.ycombinator.com/partners")
    profile_urls = _parse_yc_partners_listing(html)
    log.info("Found %d partner profiles", len(profile_urls))

    if limit:
        profile_urls = profile_urls[:limit]

    all_profiles: list[dict] = []
    for i, url in enumerate(profile_urls):
        log.info("[%d/%d] Fetching profile %s", i + 1, len(profile_urls), url)
        try:
            html = _fetch_yc(url)
            profile = _parse_yc_partner_profile(html)
            if profile:
                all_profiles.append(profile)
                log.info("  %s | %d companies", profile.get("name"), len(profile.get("companies", [])))
            else:
                log.warning("  Could not parse profile JSON at %s", url)
        except Exception:
            log.exception("  Failed to fetch %s", url)
        time.sleep(CRAWL_DELAY_SECONDS)

    if dry_run:
        log.info("[DRY-RUN] Would write %d YC partners to DB", len(all_profiles))
        for p in all_profiles:
            log.info("  %s | bio=%s | twitter=%s | linkedin=%s | %d companies",
                     p.get("name"), bool(p.get("bio")), bool(p.get("twitter")),
                     bool(p.get("linkedin")), len(p.get("companies", [])))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    for profile in all_profiles:
        try:
            name = profile.get("name", "")
            contact_id = get_or_create_contact(sb, org_id, name)
            update_contact_profile(
                sb, contact_id,
                bio=profile.get("bio"),
                email=None,
                role="Partner",
                linkedin_url=(
                    f"https://linkedin.com/in/{profile['linkedin']}"
                    if profile.get("linkedin") else None
                ),
                other_sites=(
                    {"twitter": f"https://twitter.com/{profile['twitter']}"}
                    if profile.get("twitter") else None
                ),
            )
            for co in profile.get("companies", []):
                co_name = co["name"].strip()
                co_url = co["url"] or None
                if not co_name:
                    continue
                company_id = upsert_company(sb, co_name, co_url, None)
                get_or_create_contact_investment(sb, contact_id, company_id, "current", None)
                get_or_create_portfolio_investment(sb, org_id, company_id, None)
            log.info("Wrote %s: %d companies", name, len(profile.get("companies", [])))
        except Exception:
            log.exception("Failed writing partner %r, skipping", profile.get("name"))


def scrape_yc_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape the full YC company directory via Algolia API.

    Phase 1 — open /companies with Playwright to capture Algolia credentials
    Phase 2 — paginate Algolia (no crawl delay needed — it's their own search API)
    Phase 3 — upsert companies, portfolio_investments, vertical_focus for YC
    """
    org_name = "Y Combinator"
    org_website = "https://www.ycombinator.com"
    entity_type = "Accelerator"

    log.info("Capturing Algolia credentials from YC companies page")
    app_id, api_key, index = _get_yc_algolia_creds()

    log.info("Fetching all YC companies from Algolia index=%s", index)
    all_hits: list[dict] = []
    page_num = 0
    while True:
        result = _query_yc_algolia(app_id, api_key, index, page_num)
        hits = result.get("hits", [])
        nb_pages = result.get("nbPages", 1)
        all_hits.extend(hits)
        log.info("  Page %d/%d: %d hits (total so far: %d)", page_num + 1, nb_pages, len(hits), len(all_hits))
        if page_num >= nb_pages - 1:
            break
        page_num += 1

    log.info("Total YC companies from Algolia: %d", len(all_hits))

    if limit:
        all_hits = all_hits[:limit]
        log.info("Limited to %d for this run", len(all_hits))

    if dry_run:
        log.info("[DRY-RUN] Would write %d YC companies to DB", len(all_hits))
        for h in all_hits[:5]:
            log.info("  %r batch=%r tags=%r website=%r",
                     h.get("name"), h.get("batch"), (h.get("tags") or [])[:3], h.get("website"))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    inserted = skipped = 0
    for i, hit in enumerate(all_hits):
        try:
            name = (hit.get("name") or "").strip()
            if not name:
                skipped += 1
                continue

            description = (hit.get("one_liner") or "").strip() or None
            website = (hit.get("website") or "").strip() or None
            batch = (hit.get("batch") or "").strip() or None
            tags: list[str] = [t for t in (hit.get("tags") or []) if t]
            year = _batch_to_year(batch)

            company_id = upsert_company(sb, name, website, description)
            get_or_create_portfolio_investment(sb, org_id, company_id, None, year)

            for tag in tags:
                vertical_id = get_or_create_vertical(sb, tag.strip())
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if (i + 1) % 100 == 0:
                log.info("  Progress: %d/%d companies written", i + 1, len(all_hits))
        except Exception:
            log.exception("  Failed for %r, skipping", hit.get("name"))
            skipped += 1

    log.info("YC companies done: %d written, %d skipped", inserted, skipped)


# ---------------------------------------------------------------------------
# Tribeca Venture Partners — team + companies
# ---------------------------------------------------------------------------

_TRIBECA_BASE = "https://tribecavp.com"

_TRIBECA_SECTOR_SLUG: dict[str, str] = {
    "ai-machine-learning": "AI & Machine Learning",
    "climate-tech": "Climate Tech",
    "consumer": "Consumer",
    "deep-tech": "Deep Tech",
    "digital-health": "Digital Health",
    "edtech": "Edtech",
    "fintech": "Fintech",
    "marketplaces": "Marketplaces",
    "martech": "Martech",
    "robotics": "Robotics",
    "saas": "SaaS",
    "security": "Security",
}

_TRIBECA_STAGE_SLUG: dict[str, str] = {
    "seed": "Seed",
    "series-a": "Series A",
    "series-b": "Series B",
    "series-c": "Series C",
    "series-d": "Series D",
}


def _parse_tribeca_team_listing(html: str) -> list[str]:
    """Return absolute profile URLs from the /team/ grid."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    urls: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/team/" not in href:
            continue
        after_team = href.split("/team/", 1)[-1].strip("/")
        if not after_team:
            continue
        full = href if href.startswith("http") else _TRIBECA_BASE + href
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def _parse_tribeca_partner_profile(html: str) -> dict | None:
    """
    Parse one Tribeca partner profile page.

    Returns {name, title, bio, linkedin, twitter, investments: [{name, status}]}.
    """
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.select_one("article h1") or soup.select_one("h1")
    if not h1:
        return None
    name = re.sub(r"\s+", " ", h1.get_text(separator=" ")).strip()

    title_el = soup.select_one("h2.font-bold.text-base")
    title = title_el.get_text(strip=True) if title_el else None

    linkedin: str | None = None
    twitter: str | None = None
    for a in soup.select("ul.list-none a[href]"):
        href = a["href"]
        if "linkedin.com" in href:
            linkedin = href
        elif "twitter.com" in href or "x.com" in href:
            twitter = href

    # Full bio is in the first div.prose.max-w-none on the page
    # (the Five Things items use span.prose, not div)
    bio_div = soup.select_one("div.prose.max-w-none")
    bio = None
    if bio_div:
        parts = [p.get_text(strip=True) for p in bio_div.find_all("p") if p.get_text(strip=True)]
        bio = " ".join(parts) or None

    investments: list[dict] = []
    inv_header = soup.find("h2", string=re.compile(r"^\s*Investments\s*$", re.I))
    if inv_header:
        inv_ul = inv_header.find_next("ul")
        if inv_ul:
            for li in inv_ul.find_all("li"):
                a_tag = li.find("a")
                if not a_tag:
                    continue
                name_span = a_tag.find("span", class_=lambda c: c and "text-gray-900" in c)
                status_span = a_tag.find("span", class_=lambda c: c and "text-orange-500" in c)
                co_name = name_span.get_text(strip=True) if name_span else None
                raw_status = status_span.get_text(strip=True) if status_span else None
                status = raw_status if raw_status and raw_status.strip() and raw_status.strip() != "\xa0" else None
                if co_name:
                    investments.append({"name": co_name, "status": status})

    return {
        "name": name,
        "title": title,
        "bio": bio,
        "linkedin": linkedin,
        "twitter": twitter,
        "investments": investments,
    }


def _get_tribeca_companies_data(url: str) -> list[dict]:
    """
    Load the companies page and extract the Alpine.js reactive `companies` array.

    Falls back to parsing rendered card HTML if Alpine data is unavailable.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)

        # Try Alpine v3 internal data stack
        companies = page.evaluate("""
            () => {
                const els = document.querySelectorAll('[x-data]');
                for (const el of els) {
                    if (el._x_dataStack) {
                        for (const d of el._x_dataStack) {
                            if (Array.isArray(d.companies)) return d.companies;
                        }
                    }
                }
                return null;
            }
        """)

        if not companies:
            # Fallback: parse rendered grid-item divs
            html = page.content()
            ctx.close()
            browser.close()
            return _parse_tribeca_companies_html(html)

        ctx.close()
        browser.close()
    return companies


def _parse_tribeca_companies_html(html: str) -> list[dict]:
    """Fallback: extract company data from rendered grid-item divs."""
    soup = BeautifulSoup(html, "html.parser")
    results = []
    seen: set[str] = set()
    for div in soup.select("div.grid-item"):
        img = div.find("img")
        alt = (img.get("alt") or "").strip() if img else ""
        name = re.sub(r"\s+Logo(\s+Grey)?\s*$", "", alt, flags=re.IGNORECASE).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        css_classes = " ".join(div.get("class", []))
        badge = div.select_one("span.block")
        status = badge.get_text(strip=True) if badge else None
        results.append({
            "title": name,
            "postTaxTerms": css_classes.split(),
            "companyDetails": {"status": status or ""},
        })
    return results


def scrape_tribeca_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Tribeca VP /team/ → each partner profile → DB.

    Writes: organization, contacts, companies, portfolio_investments,
    contact_investments (with exit_note from status badge).
    """
    org_name = "Tribeca Venture Partners"
    org_website = _TRIBECA_BASE
    entity_type = "Early-Stage VC"

    log.info("Fetching Tribeca team listing")
    html = _fetch_yc(_TRIBECA_BASE + "/team/")
    profile_urls = _parse_tribeca_team_listing(html)
    log.info("Found %d partner profiles", len(profile_urls))

    if limit:
        profile_urls = profile_urls[:limit]

    all_profiles: list[dict] = []
    for i, url in enumerate(profile_urls):
        log.info("[%d/%d] Fetching %s", i + 1, len(profile_urls), url)
        try:
            html = _fetch_yc(url)
            profile = _parse_tribeca_partner_profile(html)
            if profile:
                all_profiles.append(profile)
                log.info("  %s | %s | %d investments",
                         profile.get("name"), profile.get("title"),
                         len(profile.get("investments", [])))
            else:
                log.warning("  Could not parse profile at %s", url)
        except Exception:
            log.exception("  Failed to fetch %s", url)
        time.sleep(CRAWL_DELAY_SECONDS)

    if dry_run:
        log.info("[DRY-RUN] Would write %d Tribeca partners", len(all_profiles))
        for p in all_profiles:
            log.info("  %s | %s | linkedin=%s | twitter=%s | %d investments",
                     p.get("name"), p.get("title"),
                     bool(p.get("linkedin")), bool(p.get("twitter")),
                     len(p.get("investments", [])))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    for profile in all_profiles:
        try:
            name = profile.get("name", "")
            contact_id = get_or_create_contact(sb, org_id, name)
            update_contact_profile(
                sb, contact_id,
                bio=profile.get("bio"),
                email=None,
                role=profile.get("title") or "Partner",
                linkedin_url=profile.get("linkedin"),
                other_sites=(
                    {"twitter": profile["twitter"]}
                    if profile.get("twitter") else None
                ),
            )
            for inv in profile.get("investments", []):
                co_name = inv["name"].strip()
                if not co_name:
                    continue
                company_id = upsert_company(sb, co_name, None, None)
                get_or_create_contact_investment(
                    sb, contact_id, company_id, "current", inv.get("status")
                )
                get_or_create_portfolio_investment(sb, org_id, company_id, None)
            log.info("Wrote %s: %d investments", name, len(profile.get("investments", [])))
        except Exception:
            log.exception("Failed writing partner %r, skipping", profile.get("name"))


def scrape_tribeca_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Tribeca VP /companies/ page via Alpine.js reactive data.

    Upserts companies, portfolio_investments (with investment stage),
    and vertical_focus entries for TVP from sector taxonomy.
    """
    org_name = "Tribeca Venture Partners"
    org_website = _TRIBECA_BASE
    entity_type = "Early-Stage VC"

    log.info("Loading Tribeca companies page")
    companies = _get_tribeca_companies_data(_TRIBECA_BASE + "/companies/")
    log.info("Found %d companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Tribeca companies", len(companies))
        for c in companies[:5]:
            terms = c.get("postTaxTerms") or []
            details = c.get("companyDetails") or {}
            _raw = (details.get("about") or "").strip()
            about = BeautifulSoup(_raw, "html.parser").get_text(separator=" ").strip()[:80]
            log.info("  %r terms=%r about=%r", c.get("title"), terms[:4], about)
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    inserted = skipped = 0
    for c in companies:
        try:
            name = (c.get("title") or "").strip()
            if not name:
                skipped += 1
                continue

            details = c.get("companyDetails") or {}
            website = (details.get("website") or "").strip() or None
            _about_raw = (details.get("about") or "").strip()
            description = BeautifulSoup(_about_raw, "html.parser").get_text(separator=" ").strip() or None
            stage: str | None = None
            sectors: list[str] = []

            for term in (c.get("postTaxTerms") or []):
                if term in _TRIBECA_STAGE_SLUG:
                    stage = _TRIBECA_STAGE_SLUG[term]
                elif term in _TRIBECA_SECTOR_SLUG:
                    sectors.append(_TRIBECA_SECTOR_SLUG[term])

            company_id = upsert_company(sb, name, website, description)
            get_or_create_portfolio_investment(sb, org_id, company_id, stage)

            for sector in sectors:
                vertical_id = get_or_create_vertical(sb, sector)
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if inserted % 20 == 0:
                log.info("  Progress: %d companies written", inserted)
        except Exception:
            log.exception("  Failed for %r, skipping", c.get("title"))
            skipped += 1

    log.info("Tribeca companies done: %d written, %d skipped", inserted, skipped)


# ---------------------------------------------------------------------------
# Alumni Ventures (av.vc) — team scraper
# ---------------------------------------------------------------------------

_AV_VC_BASE = "https://www.av.vc"
_AV_VC_INVESTMENT_SECTIONS = {"Leadership", "Investment Professionals"}


def _fetch_av_vc_team_data(url: str) -> list[dict]:
    """
    Fetch av.vc/about, extract __NEXT_DATA__ JSON, return a flat list of
    team member dicts for Leadership and Investment Professionals sections.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)
        next_data_raw = page.evaluate(
            "() => document.getElementById('__NEXT_DATA__')?.textContent"
        )
        ctx.close()
        browser.close()

    if not next_data_raw:
        log.warning("__NEXT_DATA__ not found on %s", url)
        return []

    try:
        data = _json.loads(next_data_raw)
    except Exception:
        log.exception("Failed to parse __NEXT_DATA__ JSON")
        return []

    modules = data.get("props", {}).get("pageProps", {}).get("modules", [])
    teams_module = next((m for m in modules if m.get("type") == "teams"), None)
    if not teams_module:
        log.warning("No 'teams' module found in __NEXT_DATA__")
        return []

    sections = (teams_module.get("data", {}).get("teams") or {}).get("sections", [])
    people: list[dict] = []
    for section in sections:
        section_name = section.get("sectionName", "")
        if section_name not in _AV_VC_INVESTMENT_SECTIONS:
            continue
        for pe in section.get("people", []):
            info = (pe.get("person") or {}).get("info") or {}
            name = (info.get("name") or "").strip()
            if not name:
                continue

            linkedin: str | None = None
            twitter: str | None = None
            for social in (info.get("some") or []):
                stype = (social.get("type") or "").lower()
                link = (social.get("link") or "").strip()
                if not link:
                    continue
                if stype == "linkedin":
                    linkedin = link
                elif stype in ("twitter", "x"):
                    twitter = link

            bio_html = (info.get("bio") or {}).get("richtext") or info.get("summary") or ""
            bio = BeautifulSoup(bio_html, "html.parser").get_text(separator=" ").strip() or None

            deals = [
                d["title"].strip()
                for d in (info.get("notableDeals") or [])
                if d.get("title") and d["title"].strip()
            ]

            people.append({
                "name": name,
                "role": (pe.get("title") or info.get("title") or "Investor").strip(),
                "bio": bio,
                "linkedin": linkedin,
                "twitter": twitter,
                "section": section_name,
                "deals": deals,
            })

    return people


def scrape_av_vc_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Alumni Ventures /about page team data from __NEXT_DATA__ JSON.

    Scrapes Leadership + Investment Professionals sections.
    Writes: organization, contacts (with bio/LinkedIn), companies (notableDeals),
    portfolio_investments, contact_investments.
    """
    org_name = "Alumni Ventures"
    org_website = _AV_VC_BASE
    entity_type = "Multi-Stage VC"

    log.info("Fetching Alumni Ventures team data from __NEXT_DATA__")
    people = _fetch_av_vc_team_data(_AV_VC_BASE + "/about")
    log.info("Found %d people across target sections", len(people))

    if limit:
        people = people[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Alumni Ventures contacts", len(people))
        for p in people:
            log.info("  %s | %s | linkedin=%s | %d deals",
                     p["name"], p.get("role"), bool(p.get("linkedin")), len(p.get("deals", [])))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    for person in people:
        try:
            name = person["name"]
            contact_id = get_or_create_contact(sb, org_id, name)
            update_contact_profile(
                sb, contact_id,
                bio=person.get("bio"),
                email=None,
                role=person.get("role"),
                linkedin_url=person.get("linkedin"),
                other_sites=(
                    {"twitter": person["twitter"]}
                    if person.get("twitter") else None
                ),
            )
            for deal_name in person.get("deals", []):
                company_id = upsert_company(sb, deal_name, None, None)
                get_or_create_contact_investment(sb, contact_id, company_id, "current", None)
                get_or_create_portfolio_investment(sb, org_id, company_id, None)
            log.info("Wrote %s | %s | %d deals", name, person.get("section"), len(person.get("deals", [])))
        except Exception:
            log.exception("Failed writing %r, skipping", person.get("name"))


def _build_av_vc_fund_keyword_map(portfolio_companies: list[dict]) -> dict[str, str]:
    """
    Build keyword → fund_slug from portfolio company fund tags.

    "University of Texas: Congress Avenue Ventures" → keyword "congress avenue"
    "AV: Sports Fund" → keyword "sports fund"
    "AV: Deep Tech" → keyword "deep tech"
    """
    result: dict[str, str] = {}
    for c in portfolio_companies:
        for fund in (c.get("funds") or []):
            slug = fund.get("slug")
            name = fund.get("name") or ""
            if not slug or not name:
                continue
            kw = name
            if ":" in kw:
                kw = kw.split(":", 1)[1].strip()
            kw = re.sub(r"\s+ventures?$", "", kw, flags=re.IGNORECASE).strip().lower()
            if kw and slug not in result.values():
                result[kw] = slug
    return result


def _av_vc_get_fund_slugs_from_role(role: str, keyword_map: dict[str, str]) -> list[str]:
    """Return fund slugs whose keyword appears in the investor's role string."""
    role_lower = role.lower()
    return [slug for kw, slug in keyword_map.items() if kw in role_lower]


def _fetch_av_vc_portfolio_data(url: str) -> list[dict]:
    """
    Fetch av.vc/portfolio, extract __NEXT_DATA__ JSON, return flat list of
    company dicts: {name, description, website, stage, sector}.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        next_data_raw = page.evaluate(
            "() => document.getElementById('__NEXT_DATA__')?.textContent"
        )
        ctx.close()
        browser.close()

    if not next_data_raw:
        log.warning("__NEXT_DATA__ not found on %s", url)
        return []

    try:
        data = _json.loads(next_data_raw)
    except Exception:
        log.exception("Failed to parse __NEXT_DATA__ JSON")
        return []

    modules = data.get("props", {}).get("pageProps", {}).get("modules", [])
    portfolio_module = next((m for m in modules if m.get("type") == "portfolio"), None)
    if not portfolio_module:
        log.warning("No 'portfolio' module found in __NEXT_DATA__")
        return []

    return portfolio_module["data"]["portfolio"].get("companies") or []


def scrape_av_vc_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Alumni Ventures /portfolio page from __NEXT_DATA__ JSON.

    Upserts all portfolio companies with descriptions, websites, and
    portfolio_investments for Alumni Ventures. Sector tags → vertical_focus.
    """
    org_name = "Alumni Ventures"
    org_website = _AV_VC_BASE
    entity_type = "Multi-Stage VC"

    log.info("Fetching Alumni Ventures portfolio data from __NEXT_DATA__")
    companies = _fetch_av_vc_portfolio_data(_AV_VC_BASE + "/portfolio")
    log.info("Found %d companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d AV portfolio companies", len(companies))
        for c in companies[:5]:
            info = c.get("info") or {}
            tags = c.get("tags") or {}
            log.info("  %r  stage=%r  sector=%r  desc=%r",
                     c.get("name"),
                     (tags.get("stage") or {}).get("name"),
                     (tags.get("sector") or {}).get("name"),
                     (info.get("description") or "")[:80])
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, org_website)

    # Phase 1: upsert companies and build fund → [company_id] index
    fund_slug_to_company_ids: dict[str, list[str]] = {}
    inserted = skipped = 0
    for i, c in enumerate(companies):
        try:
            name = (c.get("name") or "").strip()
            if not name:
                skipped += 1
                continue

            info = c.get("info") or {}
            description = (info.get("description") or "").strip() or None
            website = (info.get("url") or "").strip() or None
            tags = c.get("tags") or {}
            stage_name = (tags.get("stage") or {}).get("name") or None
            sector_name = (tags.get("sector") or {}).get("name") or None

            company_id = upsert_company(sb, name, website, description)
            get_or_create_portfolio_investment(sb, org_id, company_id, stage_name)

            for fund in (c.get("funds") or []):
                slug = fund.get("slug")
                if slug:
                    fund_slug_to_company_ids.setdefault(slug, []).append(company_id)

            if sector_name:
                vertical_id = get_or_create_vertical(sb, sector_name)
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if inserted % 100 == 0:
                log.info("  Progress: %d/%d companies written", inserted, len(companies))
        except Exception:
            log.exception("  Failed for %r, skipping", c.get("name"))
            skipped += 1

    log.info("AV portfolio phase 1 done: %d written, %d skipped", inserted, skipped)

    # Phase 2: link AV contacts to all companies in their fund(s) via contact_investments
    keyword_map = _build_av_vc_fund_keyword_map(companies)
    log.info("Fund keyword map: %d entries (from %d funds)", len(keyword_map), len(fund_slug_to_company_ids))

    contacts_res = sb.table("contacts").select("id, first_name, last_name, role").eq("org_id", org_id).execute()
    log.info("Linking %d AV contacts to fund portfolio companies", len(contacts_res.data))

    total_inserted = 0
    for contact in contacts_res.data:
        contact_id = contact["id"]
        role = contact.get("role") or ""
        if not role:
            continue
        fund_slugs = _av_vc_get_fund_slugs_from_role(role, keyword_map)
        if not fund_slugs:
            continue
        wanted_ids = list(dict.fromkeys(
            cid
            for slug in fund_slugs
            for cid in fund_slug_to_company_ids.get(slug, [])
        ))
        display_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        log.info("  %s → %d fund(s), %d companies", display_name, len(fund_slugs), len(wanted_ids))

        # Fetch existing contact_investments for this contact in one query
        existing_res = (
            sb.table("contact_investments")
            .select("company_id")
            .eq("contact_id", contact_id)
            .eq("relationship", "current")
            .execute()
        )
        existing_set = {r["company_id"] for r in existing_res.data}
        to_insert = [cid for cid in wanted_ids if cid not in existing_set]

        # Batch insert in chunks of 500
        for chunk_start in range(0, len(to_insert), 500):
            chunk = to_insert[chunk_start : chunk_start + 500]
            rows = [{"contact_id": contact_id, "company_id": cid, "relationship": "current", "exit_note": None} for cid in chunk]
            try:
                sb.table("contact_investments").insert(rows).execute()
                total_inserted += len(chunk)
            except Exception:
                log.exception("    batch insert failed for %s (chunk %d)", display_name, chunk_start)

    log.info("AV fund linkage done: %d new contact_investments inserted", total_inserted)


FIRM_REGISTRY = {
    "greylock": {
        "name": "Greylock",
        "website": "https://greylock.com",
        "url": "https://greylock.com/portfolio/",
        "entity_type": "Multi-Stage VC",
        "parser": parse_greylock,
    },
    "sequoia": {
        "name": "Sequoia",
        "website": "https://www.sequoiacap.com",
        "url": "https://sequoiacap.com/our-companies/#all-panel",
        "entity_type": "Multi-Stage VC",
        "parser": parse_sequoia,
        "fetch_fn": lambda url: fetch_with_load_more(url, row_selector="table tr"),
    },
}


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_rendered_html(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()
        page.goto(url, timeout=30000, wait_until="networkidle")
        page.wait_for_timeout(3000)
        html = page.content()
        browser.close()
        return html


# ---------------------------------------------------------------------------
# DB helpers (sequential, respecting FK order)
# ---------------------------------------------------------------------------

_LEGAL_SUFFIX_RE = re.compile(
    r"\s*[,.]?\s*\b(inc\.?|corp\.?|llc\.?|ltd\.?|limited|incorporated|corporation|co\.?|group|holdings?|plc|pbc)\s*$",
    re.IGNORECASE,
)


def _normalize_company_name(name: str) -> str:
    """Strip legal suffixes so 'Stripe Inc.' and 'Stripe' map to the same row."""
    n = _LEGAL_SUFFIX_RE.sub("", name).strip().rstrip(",.")
    return n if n else name


def get_or_create_organization(sb: Client, name: str, entity_type_name: str, website: str | None) -> str:
    existing = sb.table("organizations").select("id").eq("name", name).execute()
    if existing.data:
        return existing.data[0]["id"]

    entity_type_id = None
    et = sb.table("entity_types").select("id").eq("type_name", entity_type_name).execute()
    if et.data:
        entity_type_id = et.data[0]["id"]

    inserted = sb.table("organizations").insert(
        {"name": name, "entity_type_id": entity_type_id, "website": website}
    ).execute()
    return inserted.data[0]["id"]


def upsert_company(sb: Client, name: str, website: str | None, description: str | None) -> str:
    # Normalize before lookup: strips legal suffixes so "Stripe Inc." and "Stripe"
    # (from different firm scrapers) resolve to the same row.
    canonical = _normalize_company_name(name)

    existing = sb.table("companies").select("id").ilike("name", canonical).execute()
    # Fallback: try original name in case it was stored before normalization was added
    if not existing.data and canonical != name:
        existing = sb.table("companies").select("id").ilike("name", name).execute()

    if existing.data:
        company_id = existing.data[0]["id"]
        if website or description:
            sb.table("companies").update(
                {k: v for k, v in {"website": website, "description": description}.items() if v}
            ).eq("id", company_id).execute()
        return company_id

    result = sb.table("companies").insert(
        {"name": canonical, "website": website, "description": description},
    ).execute()
    return result.data[0]["id"]


def get_or_create_contact(sb: Client, org_id: str, full_name: str) -> str:
    normalized = re.sub(r"\s+", " ", full_name).strip()
    parts = normalized.split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    existing = (
        sb.table("contacts")
        .select("id")
        .eq("org_id", org_id)
        .eq("first_name", first_name)
        .eq("last_name", last_name)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    inserted = sb.table("contacts").insert(
        {"org_id": org_id, "first_name": first_name, "last_name": last_name}
    ).execute()
    return inserted.data[0]["id"]


def get_or_create_portfolio_investment(
    sb: Client, org_id: str, company_id: str,
    stage: str | None, year_partnered: int | None = None,
) -> None:
    existing = (
        sb.table("portfolio_investments")
        .select("id, investment_stage, year_partnered")
        .eq("org_id", org_id)
        .eq("company_id", company_id)
        .execute()
    )
    if existing.data:
        updates = {}
        if stage and not existing.data[0]["investment_stage"]:
            updates["investment_stage"] = stage
        if year_partnered and not existing.data[0]["year_partnered"]:
            updates["year_partnered"] = year_partnered
        if updates:
            sb.table("portfolio_investments").update(updates).eq("id", existing.data[0]["id"]).execute()
        return
    sb.table("portfolio_investments").insert(
        {"org_id": org_id, "company_id": company_id, "investment_stage": stage, "year_partnered": year_partnered}
    ).execute()


def get_or_create_vertical(sb: Client, vertical_name: str) -> str:
    existing = sb.table("verticals").select("id").eq("vertical_name", vertical_name).execute()
    if existing.data:
        return existing.data[0]["id"]
    inserted = sb.table("verticals").insert({"vertical_name": vertical_name}).execute()
    return inserted.data[0]["id"]


def get_or_create_vertical_focus(sb: Client, org_id: str, vertical_id: str) -> None:
    existing = (
        sb.table("vertical_focus")
        .select("id")
        .eq("org_id", org_id)
        .eq("vertical_id", vertical_id)
        .execute()
    )
    if existing.data:
        return
    sb.table("vertical_focus").insert({"org_id": org_id, "vertical_id": vertical_id}).execute()


def update_contact_profile(
    sb: Client,
    contact_id: str,
    bio: str | None,
    email: str | None,
    role: str | None,
    linkedin_url: str | None,
    other_sites: dict | None,
) -> None:
    updates = {
        k: v
        for k, v in {
            "bio": bio,
            "email": email,
            "role": role,
            "linkedin_url": linkedin_url,
            "other_sites": other_sites or None,
        }.items()
        if v
    }
    if updates:
        sb.table("contacts").update(updates).eq("id", contact_id).execute()


def get_or_create_contact_investment(
    sb: Client, contact_id: str, company_id: str, relationship: str, exit_note: str | None
) -> None:
    existing = (
        sb.table("contact_investments")
        .select("id")
        .eq("contact_id", contact_id)
        .eq("company_id", company_id)
        .eq("relationship", relationship)
        .execute()
    )
    if existing.data:
        return
    sb.table("contact_investments").insert(
        {"contact_id": contact_id, "company_id": company_id, "relationship": relationship, "exit_note": exit_note}
    ).execute()


# ---------------------------------------------------------------------------
# Team / partner bio scraping (Greylock)
# ---------------------------------------------------------------------------

def parse_greylock_team_listing(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    section = soup.select_one("section.investors")
    if not section:
        return []

    investors = []
    for box in section.select(".investor-box"):
        h3 = box.select_one("h3")
        link = box.select_one("a.btn")
        if not h3 or not link:
            continue
        role_el = box.select_one("p.s")
        investors.append(
            {
                "name": re.sub(r"\s+", " ", h3.get_text(strip=True)),
                "profile_url": link["href"],
                # Greylock's team page only labels some investors (e.g. "Partner") and
                # leaves the rest blank; fall back to "Investor" (the page's own section
                # name) rather than fabricating a title the site doesn't actually give us.
                "role": role_el.get_text(strip=True) if role_el else "Investor",
            }
        )
    return investors


def parse_greylock_investor_profile(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    banner = soup.select_one("section.bio-banner")

    tagline_el = banner.select_one(".text-area p.l") if banner else None
    tagline = tagline_el.get_text(strip=True) if tagline_el else None

    linkedin_url = None
    other_sites = {}
    if banner:
        # Only direct <a> children of .social-link are the person's own links (twitter,
        # linkedin) -- email-link/download-link are nested divs matched separately below.
        social = banner.select_one(".text-area .social-link")
        for a in (social.find_all("a", recursive=False) if social else []):
            href = a.get("href", "")
            if not href:
                continue
            if "linkedin.com" in href:
                linkedin_url = href
            elif "twitter.com" in href or "x.com" in href:
                other_sites["twitter"] = href
            else:
                other_sites[urlparse(href).netloc or href] = href

    email = None
    if banner:
        email_link = banner.select_one(".email-link a[href^='mailto:']")
        if email_link:
            email = email_link["href"].removeprefix("mailto:")

    pdf_url = None
    if banner:
        for a in banner.select(".sub-download a"):
            href = a.get("href", "")
            if href.lower().endswith(".pdf"):
                pdf_url = href
                break

    return {
        "tagline": tagline,
        "linkedin_url": linkedin_url,
        "other_sites": other_sites,
        "email": email,
        "pdf_url": pdf_url,
    }


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


_INVESTMENTS_HEADER_RE = re.compile(r"^(CURRENT INVESTMENTS|PREVIOUS INVESTMENTS|INVESTMENTS)$")
_EXIT_KEYWORDS_RE = re.compile(r"acqui|ipo", re.IGNORECASE)


def parse_bio_pdf(pdf_bytes: bytes) -> dict:
    # Bio length and whether there's an investments page (and whether it's split into
    # CURRENT/PREVIOUS or a single combined "INVESTMENTS" list) varies per partner, so
    # this scans the whole document rather than assuming a fixed page layout.
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        full_text = "\n".join((p.extract_text(x_tolerance=1) or "") for p in pdf.pages)

    lines = full_text.split("\n")
    header_idx = next((i for i, l in enumerate(lines) if _INVESTMENTS_HEADER_RE.match(l.strip())), None)

    bio_lines = lines[2:header_idx] if header_idx is not None else lines[2:]
    bio = " ".join(l.strip() for l in bio_lines if l.strip()).strip() or None

    current, previous = [], []
    if header_idx is not None:
        section = None
        for line in lines[header_idx:]:
            stripped = line.strip()
            if stripped in ("CURRENT INVESTMENTS", "PREVIOUS INVESTMENTS", "INVESTMENTS"):
                section = {"CURRENT INVESTMENTS": "current", "PREVIOUS INVESTMENTS": "previous", "INVESTMENTS": "mixed"}[stripped]
                continue
            item_line = stripped.lstrip("●").strip()
            if not item_line:
                continue
            m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", item_line)
            company, note = (m.group(1).strip(), m.group(2).strip()) if m else (item_line, None)
            entry = {"company": company, "note": note}
            if section == "current":
                current.append(entry)
            elif section == "previous":
                previous.append(entry)
            elif section == "mixed":
                (previous if note and _EXIT_KEYWORDS_RE.search(note) else current).append(entry)

    return {"bio": bio, "current": current, "previous": previous}


def scrape_greylock_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    firm = FIRM_REGISTRY["greylock"]
    team_url = "https://greylock.com/team/"

    parsed = urlparse(firm["url"])
    homepage = f"{parsed.scheme}://{parsed.netloc}/"
    if dry_run:
        org_id = "[DRY-RUN]"
    else:
        org_id = get_or_create_organization(sb, firm["name"], firm["entity_type"], homepage)

    log.info("Fetching investor listing from %s", team_url)
    html = fetch_rendered_html(team_url)
    investors = parse_greylock_team_listing(html)
    if limit:
        investors = investors[:limit]
    log.info("Processing %d investors%s", len(investors), " [DRY-RUN]" if dry_run else "")

    for i, investor in enumerate(investors):
        try:
            time.sleep(CRAWL_DELAY_SECONDS)
            log.info("Fetching profile: %s (%s)", investor["name"], investor["profile_url"])
            profile_html = fetch_rendered_html(investor["profile_url"])
            profile = parse_greylock_investor_profile(profile_html)

            bio = profile["tagline"]
            current, previous = [], []
            if profile["pdf_url"]:
                pdf_bytes = download_bytes(profile["pdf_url"])
                parsed_pdf = parse_bio_pdf(pdf_bytes)
                bio = parsed_pdf["bio"] or bio
                current = parsed_pdf["current"]
                previous = parsed_pdf["previous"]
            else:
                log.warning("%s: no bio PDF found, capturing tagline/contact info only", investor["name"])

            if dry_run:
                log.info("  [DRY-RUN] %s (%s): bio=%s email=%s — %d current / %d previous",
                         investor["name"], investor["role"], bool(bio), profile["email"],
                         len(current), len(previous))
                for item in current:
                    log.info("    CURRENT  %r — note=%r", item["company"], item["note"])
                for item in previous:
                    log.info("    PREVIOUS %r — note=%r", item["company"], item["note"])
            else:
                contact_id = get_or_create_contact(sb, org_id, investor["name"])
                update_contact_profile(
                    sb, contact_id, bio, profile["email"], investor["role"],
                    profile["linkedin_url"], profile["other_sites"]
                )
                for item in current:
                    company_id = upsert_company(sb, item["company"], None, None)
                    get_or_create_contact_investment(sb, contact_id, company_id, "current", item["note"])
                for item in previous:
                    company_id = upsert_company(sb, item["company"], None, None)
                    get_or_create_contact_investment(sb, contact_id, company_id, "previous", item["note"])

                log.info(
                    "%s: captured bio=%s email=%s, %d current / %d previous investments",
                    investor["name"], bool(bio), profile["email"], len(current), len(previous),
                )
        except Exception:
            log.exception("Failed to process investor %r, skipping", investor.get("name"))


# ---------------------------------------------------------------------------
# Andreessen Horowitz (a16z)
# ---------------------------------------------------------------------------
# Both the portfolio and team pages embed their full dataset as JSON in the
# rendered HTML (window.a16z_portfolio_companies / a data-payload attribute),
# rather than requiring per-card DOM scraping or a "load more" click loop --
# confirmed by inspecting the rendered page directly. No per-deal partner
# attribution is published, so companies are linked at the org level only
# (same as scrape_firm's generic path when a page lists no investor per row).

A16Z_BASE = "https://a16z.com"
A16Z_PORTFOLIO_URL = f"{A16Z_BASE}/portfolio/"
A16Z_TEAM_URL = f"{A16Z_BASE}/team/"

# a16z's own "stage" facet mixes funding rounds with exit/liquidity events
# (m&a, ipo, dpo, spac are outcomes, not stages) -- only map the genuine
# funding-round values into our STAGE_VOCABULARY-shaped text; leave the rest
# unstamped rather than guess.
_A16Z_STAGE_MAP = {"seed": "Seed", "venture": "Series A", "growth": "Growth"}


def _a16z_extract_json_global(page_html: str, var_name: str) -> list[dict]:
    """Extract a `window.<var_name> = [...]` embedded JSON array from raw HTML."""
    m = re.search(rf"window\.{re.escape(var_name)}\s*=\s*(\[.*?\]);", page_html, re.DOTALL)
    if not m:
        raise ValueError(f"Could not find window.{var_name} in page")
    return _json.loads(m.group(1))


def _a16z_company_description(co: dict) -> str | None:
    """Prefer the company's own 'overview' blurb; fall back to the excerpt from
    a16z's investment-announcement post when overview is blank (covers ~93% of
    the portfolio between the two, vs ~86% for overview alone)."""
    overview = (co.get("overview") or "").strip()
    if overview:
        return overview
    excerpt = ((co.get("announcement") or {}).get("excerpt") or "").strip()
    return excerpt or None


def scrape_a16z_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape a16z portfolio companies from the embedded window.a16z_portfolio_companies
    JSON on their public portfolio page. Writes: companies, portfolio_investments.
    """
    org_name = "Andreessen Horowitz"

    log.info("Fetching a16z portfolio page")
    page_html = fetch_rendered_html(A16Z_PORTFOLIO_URL)
    companies = _a16z_extract_json_global(page_html, "a16z_portfolio_companies")
    log.info("Found %d a16z portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d a16z companies", len(companies))
        for co in companies[:5]:
            log.info("  %s | %s | desc=%s | stage=%s",
                     co.get("title"), co.get("web"), bool(_a16z_company_description(co)), co.get("stage"))
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", A16Z_BASE)

    inserted, skipped = 0, 0
    for co in companies:
        try:
            name = (co.get("title") or "").strip()
            if not name or name == "[untitled]":
                skipped += 1
                continue
            website = (co.get("web") or "").strip() or None
            description = _a16z_company_description(co)
            company_id = upsert_company(sb, name, website, description)
            if not description:
                log.warning("%s: no description found on site, inserted with null description", name)

            stage_label = next(
                (_A16Z_STAGE_MAP[s] for s in (co.get("stage") or []) if s in _A16Z_STAGE_MAP),
                None,
            )
            get_or_create_portfolio_investment(sb, org_id, company_id, stage_label, None)

            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d a16z companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing a16z company %r, skipping", co.get("title"))
            skipped += 1

    log.info("a16z companies done: %d inserted/updated, %d skipped", inserted, skipped)


def _a16z_extract_team_payload(page_html: str) -> list[dict]:
    """Extract the `data-payload="{...&quot;members&quot;:[...]}"` JSON blob
    from the team page (HTML-entity-encoded, unlike the portfolio page's plain
    window.* global)."""
    import html as _html_unescape

    m = re.search(r'data-payload="(\{.*?&quot;members&quot;:\[.*?\]\})"', page_html, re.DOTALL)
    if not m:
        raise ValueError("Could not find team payload in a16z team page")
    return _json.loads(_html_unescape.unescape(m.group(1)))["members"]


def _a16z_fetch_bio(profile_url: str) -> str | None:
    """Fetch an a16z author profile page and pull their bio paragraphs. The
    bio is the first run of consecutive <p> tags sharing a parent right after
    the page header -- later paragraphs belong to an unrelated 'Content'
    teaser block (confirmed by inspecting a sample profile directly)."""
    req = urllib.request.Request(profile_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        page_html = resp.read().decode("utf-8", errors="ignore")
    soup = BeautifulSoup(page_html, "html.parser")
    paragraphs = soup.select("main p")
    if not paragraphs:
        return None
    first_parent = paragraphs[0].parent
    bio_paragraphs = []
    for p in paragraphs:
        if p.parent is not first_parent:
            break
        text = p.get_text(strip=True)
        if text:
            bio_paragraphs.append(text)
    return "\n\n".join(bio_paragraphs) or None


def scrape_a16z_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape a16z's investing team from the team page's embedded JSON payload
    (name, role, LinkedIn/Twitter, verticals), then visit each member's own
    profile page for their bio, which isn't included in that payload.
    Writes: organization, contacts (bio/LinkedIn/role), contact_verticals.
    """
    org_name = "Andreessen Horowitz"
    entity_type = "Multi-Stage VC"

    log.info("Fetching a16z team page")
    page_html = fetch_rendered_html(A16Z_TEAM_URL)
    members = _a16z_extract_team_payload(page_html)
    investing = [m for m in members if "investment-team" in (m.get("group_slugs") or [])]
    log.info("Found %d investing team members (of %d total)", len(investing), len(members))

    if limit:
        investing = investing[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d a16z contacts", len(investing))
        for m in investing:
            verts = sorted(set(m.get("vertical_slugs") or []))
            log.info("  %s | %s | verts=%s", m.get("name"), m.get("role_display"), verts)
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, A16Z_BASE)

    for member in investing:
        try:
            name = (member.get("name") or "").strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)

            socials = member.get("socials") or []
            linkedin_url = next((s["url"] for s in socials if s.get("icon") == "icon-linkedin"), None)
            twitter_url = next((s["url"] for s in socials if s.get("icon") == "icon-twitter"), None)

            bio = None
            profile_url = member.get("profile_url")
            if profile_url and not member.get("external"):
                try:
                    bio = _a16z_fetch_bio(profile_url)
                except Exception:
                    log.warning("Could not fetch bio for %s at %s", name, profile_url)
                time.sleep(CRAWL_DELAY_SECONDS)

            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=None,
                role=member.get("role_display") or None,
                linkedin_url=linkedin_url,
                other_sites={"twitter": twitter_url} if twitter_url else None,
            )

            for vertical_slug in sorted(set(member.get("vertical_slugs") or [])):
                vertical_name = vertical_slug.replace("-", " ").title()
                vertical_id = get_or_create_vertical(sb, vertical_name)
                _get_or_create_contact_vertical(sb, contact_id, vertical_id)

            log.info("Wrote %s | %s | bio=%s", name, member.get("role_display"), bool(bio))
        except Exception:
            log.exception("Failed writing a16z contact %r, skipping", member.get("name"))


# ---------------------------------------------------------------------------
# NEA
# ---------------------------------------------------------------------------
# Companies come from a dedicated JSON API (found by watching network requests
# while the portfolio page loaded, same technique used to find a16z's and
# Kleiner Perkins' data sources): www.nea.com/api/portfolio/companies returns
# all 912 companies in one call, 100% with a description. No external website
# field is in this payload at all (unlike company_stage/first_invested, which
# are both present) -- same limitation as Lightspeed's grid, deliberately not
# chased here; see DESCRIPTION_GAPS.md if a later pass wants to add it.
#
# The team page (nea.com/team) defaults to an "Investors" filter tab (vs.
# Leadership/Investor Relations/Marketing & Impact) that's already exactly the
# set we want -- confirmed every title in that default view is genuinely
# investing-track (Partner, Principal, Associate, Venture Partner, etc.), so
# no title-based filtering is needed here, unlike Lightspeed/Kleiner Perkins.
# Bios and personal LinkedIn require visiting each of the 49 individual
# nea.com/team/<slug> pages, which (like a16z's and Lightspeed's) work fine
# with a plain HTTP GET.

NEA_BASE = "https://www.nea.com"
NEA_COMPANIES_API = f"{NEA_BASE}/api/portfolio/companies"
NEA_TEAM_URL = f"{NEA_BASE}/team"

# "Public"/"public" describes a liquidity outcome, not a funding round, so it's
# deliberately left unmapped (same treatment as a16z's ipo/m&a/spac stages).
_NEA_STAGE_MAP = {"early": "Series A", "seed": "Seed", "growth": "Growth"}


def scrape_nea_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape NEA's portfolio via their public JSON API. Writes: companies (name,
    description -- no website, see module note above), portfolio_investments
    (stage, year first invested), vertical_focus (from each company's category
    tags, at the firm level -- no per-deal partner attribution is published).
    """
    org_name = "NEA"

    log.info("Fetching NEA companies from JSON API")
    req = urllib.request.Request(NEA_COMPANIES_API, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        companies = _json.loads(resp.read())["companies"]
    log.info("Found %d NEA portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d NEA companies", len(companies))
        for c in companies[:5]:
            categories = [cat.get("title") for cat in (c.get("company_category") or [])]
            log.info("  %s | stage=%s | year=%s | categories=%s", c.get("title"),
                     (c.get("company_stage") or {}).get("value"), c.get("first_invested"), categories)
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", NEA_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            name = (c.get("title") or "").strip()
            if not name:
                skipped += 1
                continue
            description = (c.get("short_description") or "").strip() or None
            company_id = upsert_company(sb, name, None, description)
            if not description:
                log.warning("%s: no description found on site, inserted with null description", name)

            stage_value = ((c.get("company_stage") or {}).get("value") or "").lower()
            stage_label = _NEA_STAGE_MAP.get(stage_value)
            year_text = (c.get("first_invested") or "").strip()
            year_partnered = int(year_text) if year_text.isdigit() and len(year_text) == 4 else None
            get_or_create_portfolio_investment(sb, org_id, company_id, stage_label, year_partnered)

            for category in (c.get("company_category") or []):
                category_name = (category.get("title") or "").strip()
                if category_name:
                    vertical_id = get_or_create_vertical(sb, category_name)
                    get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d NEA companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing NEA company %r, skipping", c.get("title"))
            skipped += 1

    log.info("NEA companies done: %d inserted/updated, %d skipped", inserted, skipped)


def _nea_parse_team_grid(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    members = []
    for card in soup.select("a.team_grid_card_root__fZIOy"):
        name_el = card.select_one(".team_grid_card_name__JAgnh")
        title_el = card.select_one(".team_grid_card_title__3bJJJ")
        href = card.get("href")
        if not name_el or not href:
            continue
        members.append({
            "name": name_el.get_text(strip=True),
            "role": title_el.get_text(strip=True) if title_el else None,
            "profile_url": f"{NEA_BASE}{href}",
        })
    return members


def _nea_fetch_bio_and_linkedin(profile_url: str) -> tuple[str | None, str | None]:
    req = urllib.request.Request(profile_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        page_html = resp.read().decode("utf-8", errors="ignore")
    soup = BeautifulSoup(page_html, "html.parser")

    bio_el = soup.select_one(".bio_hero_description__ENLos")
    bio = bio_el.get_text(strip=True) if bio_el else None

    linkedin_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "linkedin.com/in/" in href:
            linkedin_url = href
            break
    return bio, linkedin_url


def scrape_nea_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape NEA's investing team from the team page's default "Investors" tab
    (name, role), then visit each member's own profile page for bio +
    personal LinkedIn (not in the grid itself). Writes: organization,
    contacts (bio/LinkedIn/role).
    """
    org_name = "NEA"
    entity_type = "Multi-Stage VC"

    log.info("Fetching NEA team page")
    page_html = fetch_rendered_html(NEA_TEAM_URL)
    members = _nea_parse_team_grid(page_html)
    log.info("Found %d NEA team members", len(members))

    if limit:
        members = members[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d NEA contacts", len(members))
        for m in members:
            log.info("  %s | %s", m["name"], m["role"])
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, NEA_BASE)

    for member in members:
        try:
            name = member["name"].strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)

            bio, linkedin_url = None, None
            if member["profile_url"]:
                try:
                    bio, linkedin_url = _nea_fetch_bio_and_linkedin(member["profile_url"])
                except Exception:
                    log.warning("Could not fetch profile for %s at %s", name, member["profile_url"])
                time.sleep(CRAWL_DELAY_SECONDS)

            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=None,
                role=member["role"],
                linkedin_url=linkedin_url,
                other_sites=None,
            )
            log.info("Wrote %s | %s | bio=%s", name, member["role"], bool(bio))
        except Exception:
            log.exception("Failed writing NEA contact %r, skipping", member.get("name"))


# ---------------------------------------------------------------------------
# Kleiner Perkins
# ---------------------------------------------------------------------------
# Same public-WordPress-REST-API pattern as Founders Fund, but richer: custom
# ACF fields carry a real multi-paragraph description (modal_description,
# falling back to the shorter subhead/tagline), external website, LinkedIn/X,
# and dedicated `sector`/`stage`/`person_role` taxonomies (resolved to names
# via their own endpoints, not guessed from slugs) -- 411 companies across 5
# pages, 30 people in one page.

KP_BASE = "https://www.kleinerperkins.com"
KP_API = f"{KP_BASE}/wp-json/wp/v2"

# Only "Early"/"Growth" are genuine funding-round labels; "Acquired"/"IPO" are
# exit outcomes and "Prior" is a relationship marker (matches the `timing`
# field), none of which belong in investment_stage.
_KP_STAGE_MAP = {"early": "Series A", "growth": "Growth"}

# Roles confirmed via /wp-json/wp/v2/person_role -- everything not in this set
# is a back-office/operating function (Marketing, Legal, Finance, Talent,
# Operating Partner, X) rather than someone who sources/leads deals.
_KP_INVESTING_ROLE_IDS = {54, 2, 10, 9, 28, 24, 25}  # Investor, Partner, Principal, VP, Partner and Advisor, Founder, Chairman


def _kp_fetch_all(post_type: str) -> list[dict]:
    items = []
    page = 1
    while True:
        req = urllib.request.Request(
            f"{KP_API}/{post_type}?per_page=100&page={page}", headers={"User-Agent": USER_AGENT}
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            batch = _json.loads(resp.read())
        if not batch:
            break
        items.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return items


def _kp_fetch_taxonomy(taxonomy: str) -> dict[int, str]:
    req = urllib.request.Request(f"{KP_API}/{taxonomy}?per_page=100", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        terms = _json.loads(resp.read())
    import html as _html_unescape

    return {t["id"]: _html_unescape.unescape(t["name"]) for t in terms}


def _kp_company_description(acf: dict) -> str | None:
    for field in ("modal_description", "subhead", "tagline"):
        text = (acf.get(field) or "").strip()
        if text:
            return text
    return None


def scrape_kleinerperkins_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Kleiner Perkins' portfolio via their public WordPress REST API.
    Writes: companies (name, website, description), portfolio_investments
    (stage, year), vertical_focus (from each company's sector tags, at the
    firm level -- no per-deal partner attribution is published).
    """
    org_name = "Kleiner Perkins"

    log.info("Fetching Kleiner Perkins companies from REST API")
    companies = _kp_fetch_all("company")
    sector_names = _kp_fetch_taxonomy("sector")
    log.info("Found %d Kleiner Perkins portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Kleiner Perkins companies", len(companies))
        for c in companies[:5]:
            acf = c.get("acf") or {}
            name = c.get("title", {}).get("rendered")
            sectors = [sector_names.get(s) for s in (acf.get("sector") or [])]
            log.info("  %s | %s | sectors=%s | desc=%s", name, acf.get("website_url"), sectors, bool(_kp_company_description(acf)))
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", KP_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            name = (c.get("title", {}).get("rendered") or "").strip()
            if not name:
                skipped += 1
                continue
            acf = c.get("acf") or {}
            description = _kp_company_description(acf)
            website = (acf.get("website_url") or "").strip() or None
            company_id = upsert_company(sb, name, website, description)
            if not description:
                log.warning("%s: no description found on site, inserted with null description", name)

            stage_slugs = [s.replace("stage-", "") for s in (c.get("class_list") or []) if s.startswith("stage-")]
            stage_label = next((_KP_STAGE_MAP[s] for s in stage_slugs if s in _KP_STAGE_MAP), None)
            since_text = (acf.get("since_text") or "").strip()
            year_partnered = int(since_text) if since_text.isdigit() and len(since_text) == 4 else None
            get_or_create_portfolio_investment(sb, org_id, company_id, stage_label, year_partnered)

            for sector_id in (acf.get("sector") or []):
                sector_name = sector_names.get(sector_id)
                if sector_name:
                    vertical_id = get_or_create_vertical(sb, sector_name)
                    get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d Kleiner Perkins companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing Kleiner Perkins company %r, skipping", c.get("title"))
            skipped += 1

    log.info("Kleiner Perkins companies done: %d inserted/updated, %d skipped", inserted, skipped)


def scrape_kleinerperkins_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Kleiner Perkins' investing team via their public WordPress REST
    API -- bio, LinkedIn, and X are all in the same response, no per-profile
    page visits needed. Writes: organization, contacts (bio/LinkedIn/role).
    """
    org_name = "Kleiner Perkins"
    entity_type = "Multi-Stage VC"

    log.info("Fetching Kleiner Perkins team from REST API")
    all_people = _kp_fetch_all("person")
    role_names = _kp_fetch_taxonomy("person_role")
    investing = [p for p in all_people if (p.get("acf") or {}).get("role") in _KP_INVESTING_ROLE_IDS]
    log.info("Found %d investing team members (of %d total)", len(investing), len(all_people))

    if limit:
        investing = investing[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Kleiner Perkins contacts", len(investing))
        for p in investing:
            acf = p.get("acf") or {}
            role_name = role_names.get(acf.get("role"))
            log.info("  %s | %s", p.get("title", {}).get("rendered"), role_name)
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, KP_BASE)

    for person in investing:
        try:
            name = (person.get("title", {}).get("rendered") or "").strip()
            if not name:
                continue
            acf = person.get("acf") or {}
            contact_id = get_or_create_contact(sb, org_id, name)

            bio = (acf.get("bio") or "").strip() or None
            role_name = role_names.get(acf.get("role"))
            linkedin_url = (acf.get("linkedin_url") or "").strip() or None
            twitter_url = (acf.get("x_url") or "").strip() or None

            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=(acf.get("email") or "").strip() or None,
                role=role_name,
                linkedin_url=linkedin_url,
                other_sites={"twitter": twitter_url} if twitter_url else None,
            )
            log.info("Wrote %s | %s | bio=%s", name, role_name, bool(bio))
        except Exception:
            log.exception("Failed writing Kleiner Perkins contact %r, skipping", person.get("title"))


# ---------------------------------------------------------------------------
# ICONIQ
# ---------------------------------------------------------------------------
# Companies-only -- ICONIQ has no public team/people page at all (confirmed:
# iconiqcapital.com/team redirects to www.iconiq.com/team, which 404s; matches
# Firms.csv's own "N/A" note for ICONIQ's Teams column). No individual
# contacts get created for this firm as a result.
#
# The companies page (iconiq.com/growth/companies) is a Webflow site; the full
# list renders server-side into the DOM as a CMS Collection List (no API call
# needed), but oddly every company appears in the raw HTML *twice* -- same
# name, same description, same href, exactly 2x for all 171 -- confirmed by
# counting duplicates before writing the parser. Dedupe by company name.

ICONIQ_BASE = "https://iconiqcapital.com"
ICONIQ_COMPANIES_URL = "https://www.iconiq.com/growth/companies"


def _iconiq_parse_companies(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    seen_names = set()
    companies = []
    for item in soup.select(".w-dyn-item"):
        h2 = item.select_one("h2.heading-style-h3.is-companies")
        if not h2:
            continue
        name = h2.get_text(strip=True)
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        link = item.select_one("a.companies-list_grid-item-reveal-wrap")
        website = link.get("href") if link else None
        desc_el = item.select_one(".text-style-3lines.is-companies")
        description = desc_el.get_text(strip=True) if desc_el else None

        categories = [
            p.get_text(strip=True)
            for p in item.select('p[fs-cmsfilter-field="category"]')
            if p.get_text(strip=True) and p.get_text(strip=True) != "All"
        ]
        companies.append({
            "name": name,
            "website": website,
            "description": description,
            "categories": categories,
        })
    return companies


def scrape_iconiq_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape ICONIQ's Venture & Growth portfolio (companies only -- see module
    note above for why there's no team scraper for this firm). Writes:
    companies, portfolio_investments, vertical_focus (from each company's
    category tags, at the firm level).
    """
    org_name = "ICONIQ"

    log.info("Fetching ICONIQ companies page")
    page_html = fetch_rendered_html(ICONIQ_COMPANIES_URL)
    companies = _iconiq_parse_companies(page_html)
    log.info("Found %d ICONIQ portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d ICONIQ companies", len(companies))
        for c in companies[:5]:
            log.info("  %s | %s | categories=%s | desc=%s", c["name"], c["website"], c["categories"], bool(c["description"]))
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", ICONIQ_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            company_id = upsert_company(sb, c["name"], c["website"], c["description"])
            if not c["description"]:
                log.warning("%s: no description found on site, inserted with null description", c["name"])

            get_or_create_portfolio_investment(sb, org_id, company_id, None, None)

            for category in c["categories"]:
                vertical_id = get_or_create_vertical(sb, category)
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
        except Exception:
            log.exception("Failed processing ICONIQ company %r, skipping", c.get("name"))
            skipped += 1

    log.info("ICONIQ companies done: %d inserted/updated, %d skipped", inserted, skipped)


# ---------------------------------------------------------------------------
# Founders Fund
# ---------------------------------------------------------------------------
# By far the simplest scrape of the firms done so far: both companies and team
# are official WordPress custom post types exposed at a public, undocumented
# but stable REST API (/wp-json/wp/v2/company, /wp-json/wp/v2/team) -- no
# Playwright, no per-profile page visits, no rate-limit concerns (confirmed via
# the X-WP-Total header there are only 63 companies and 28 team members total,
# both fit in a single page). This matches Firms.csv's own note that "data on
# companies [is] quite sparse" -- Founders Fund publishes a curated highlight
# list, not their full historical portfolio, but what they do publish is
# unusually complete: 100% have a description, 97% have an industry tag and an
# external website link.

FOUNDERSFUND_BASE = "https://foundersfund.com"
FOUNDERSFUND_API = f"{FOUNDERSFUND_BASE}/wp-json/wp/v2"


def _foundersfund_fetch_all(post_type: str) -> list[dict]:
    req = urllib.request.Request(
        f"{FOUNDERSFUND_API}/{post_type}?per_page=100", headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return _json.loads(resp.read())


def _foundersfund_html_to_text(html_fragment: str) -> str | None:
    text = BeautifulSoup(html_fragment or "", "html.parser").get_text(separator=" ").strip()
    return text or None


def _foundersfund_extract_website(profiles_html: str) -> str | None:
    """The `profiles` field is a raw HTML snippet like
    '<p><a href="http:///www.spacex.com/">Website</a></p>' -- note the stray
    extra slash after the scheme, a site-side typo present across many
    entries, normalized here rather than stored as-is."""
    m = re.search(r'href="([^"]+)"', profiles_html or "")
    if not m:
        return None
    url = m.group(1)
    return re.sub(r"^(https?:)/{2,}", r"\1//", url)


def scrape_foundersfund_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Founders Fund's portfolio via their public WordPress REST API.
    Writes: companies (name, website, description), portfolio_investments,
    vertical_focus (from each company's industry tag, at the firm level --
    no per-deal partner attribution is published here either).
    """
    import html

    org_name = "Founders Fund"

    log.info("Fetching Founders Fund companies from REST API")
    companies = _foundersfund_fetch_all("company")
    log.info("Found %d Founders Fund portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Founders Fund companies", len(companies))
        for c in companies[:5]:
            name = c.get("title", {}).get("rendered")
            desc = _foundersfund_html_to_text(c.get("content", {}).get("rendered"))
            website = _foundersfund_extract_website(c.get("profiles"))
            industry = html.unescape(c.get("industry") or "") or None
            log.info("  %s | %s | industry=%s | desc=%s", name, website, industry, bool(desc))
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", FOUNDERSFUND_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            name = (c.get("title", {}).get("rendered") or "").strip()
            if not name:
                skipped += 1
                continue
            description = _foundersfund_html_to_text(c.get("content", {}).get("rendered"))
            website = _foundersfund_extract_website(c.get("profiles"))
            company_id = upsert_company(sb, name, website, description)
            if not description:
                log.warning("%s: no description found on site, inserted with null description", name)

            get_or_create_portfolio_investment(sb, org_id, company_id, None, None)

            industry = html.unescape(c.get("industry") or "").strip()
            if industry:
                vertical_id = get_or_create_vertical(sb, industry)
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
        except Exception:
            log.exception("Failed processing Founders Fund company %r, skipping", c.get("title"))
            skipped += 1

    log.info("Founders Fund companies done: %d inserted/updated, %d skipped", inserted, skipped)


# Non-investing back-office roles observed in the team API (CFO, General
# Counsel, Controller, IT, etc.) are excluded; anything with "partner" or
# "associate" in the title is kept.
def _foundersfund_is_investing_role(subtitle: str) -> bool:
    role_lower = (subtitle or "").lower()
    return "partner" in role_lower or role_lower == "associate"


def scrape_foundersfund_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Founders Fund's investing team via their public WordPress REST API
    -- bio, role, and Twitter are all in the same response, no per-profile
    page visits needed. Writes: organization, contacts (bio/Twitter/role).
    """
    org_name = "Founders Fund"
    entity_type = "Multi-Stage VC"

    log.info("Fetching Founders Fund team from REST API")
    all_members = _foundersfund_fetch_all("team")
    investing = [m for m in all_members if _foundersfund_is_investing_role(m.get("subtitle"))]
    log.info("Found %d investing team members (of %d total)", len(investing), len(all_members))

    if limit:
        investing = investing[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Founders Fund contacts", len(investing))
        for m in investing:
            log.info("  %s | %s", m.get("title", {}).get("rendered"), m.get("subtitle"))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, FOUNDERSFUND_BASE)

    for member in investing:
        try:
            name = (member.get("title", {}).get("rendered") or "").strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)
            bio = _foundersfund_html_to_text(member.get("content", {}).get("rendered"))
            twitter_handle = (member.get("twitter") or "").strip()
            twitter_url = f"https://twitter.com/{twitter_handle}" if twitter_handle else None

            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=None,
                role=member.get("subtitle") or None,
                linkedin_url=None,
                other_sites={"twitter": twitter_url} if twitter_url else None,
            )
            log.info("Wrote %s | %s | bio=%s", name, member.get("subtitle"), bool(bio))
        except Exception:
            log.exception("Failed writing Founders Fund contact %r, skipping", member.get("title"))


# ---------------------------------------------------------------------------
# Lightspeed
# ---------------------------------------------------------------------------
# The companies grid (lsvp.com/companies/) server-renders all ~666 portfolio
# companies in one page load (no scroll/API pagination needed -- confirmed by
# checking for XHR requests on scroll), with real structured fields per card:
# stage invested, year backed, status. No description or external website is
# in the grid itself, though -- those only live on each company's own
# lsvp.com/company/<slug>/ page, which would mean 666 individual page visits.
# Deliberately deferred (see investor_scraper/DESCRIPTION_GAPS.md) rather than
# spending ~2 hours of courtesy-delayed crawling in this pass; the structured
# stage/year data is captured now since it's free.
#
# The team page (lsvp.com/lightspeed-team/) is the opposite: rich per-member
# grid (name, role, location) but no bio/social there -- those require
# visiting each of the ~103 individual lsvp.com/team-member/<slug>/ pages,
# which (unlike the company pages) work fine with a plain HTTP GET.

LIGHTSPEED_BASE = "https://lsvp.com"
LIGHTSPEED_COMPANIES_URL = f"{LIGHTSPEED_BASE}/companies/?location=all&sector=all&investments=lsvp%2Clsip"
LIGHTSPEED_TEAM_URL = f"{LIGHTSPEED_BASE}/lightspeed-team/"

# Only genuine funding-round labels map to our STAGE_VOCABULARY-shaped text;
# "Common"/"Ordinary" are share classes, not rounds, so they're left as None.
_LIGHTSPEED_STAGE_MAP = {
    "pre-seed": "Pre-Seed",
    "seed": "Seed", "seed-1": "Seed", "seed-2": "Seed",
    "series a": "Series A", "a-1": "Series A", "early": "Series A",
    "series b": "Series B",
    "series c": "Series C+", "series d": "Series C+", "series e": "Series C+",
    "series f": "Series C+", "series g": "Series C+", "series h": "Series C+",
    "series i": "Series C+",
}

# Roles containing "partner" or "co-founder" that are actually operating/back-
# office functions, not investing partners (Lightspeed's team grid mixes both
# under similar-looking titles -- e.g. "Operating Partner, Technology",
# "Partner, Legal"). Excluded by keyword since there's no clean role_id/group
# field like a16z's team payload had.
_LIGHTSPEED_NON_INVESTING_ROLE_KEYWORDS = (
    "legal", "talent", "hr", "human resources", "marketing", "compliance",
    "controller", "cfo", "ciso", "business officer", "investor relations",
    "communications", "people,", "culture", "fundraising", "capital markets",
    "data science", "operating", "production", "value creation", "engagement",
    "new media",
)


def _lightspeed_is_investing_role(role: str) -> bool:
    role_lower = role.lower()
    if "partner" not in role_lower and "co-founder" not in role_lower:
        return False
    return not any(kw in role_lower for kw in _LIGHTSPEED_NON_INVESTING_ROLE_KEYWORDS)


def _lightspeed_parse_companies(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    companies = []
    for li in soup.select("li[data-company-id]"):
        name_el = li.select_one(".detail h5")
        if not name_el:
            continue
        # Some names carry a hover tooltip ("LSVP and LSIP Investment") noting
        # which of Lightspeed's funds invested -- it's a nested span inside the
        # <h5>, so a naive get_text() concatenates it straight onto the name
        # (e.g. "ZetwerkLSVP and LSIP Investment"). Strip it before reading text.
        info_icon = name_el.select_one(".info-icon-wrapper")
        if info_icon:
            info_icon.decompose()
        info = {}
        for row in li.select("ul.company-info-list li"):
            strong, span = row.find("strong"), row.find("span")
            if strong and span:
                info[strong.get_text(strip=True)] = span.get_text(strip=True)
        year_backed = info.get("BackedSince", "").strip()
        companies.append({
            "name": name_el.get_text(strip=True),
            "stage": info.get("StageInvested", "").strip(),
            "year_partnered": int(year_backed) if year_backed.isdigit() else None,
        })
    return companies


def scrape_lightspeed_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Lightspeed portfolio companies from the server-rendered companies
    grid. Writes: companies (name only -- no description/website; see module
    docstring above), portfolio_investments (stage, year backed).
    """
    org_name = "Lightspeed"

    log.info("Fetching Lightspeed companies page")
    page_html = fetch_rendered_html(LIGHTSPEED_COMPANIES_URL)
    companies = _lightspeed_parse_companies(page_html)
    log.info("Found %d Lightspeed portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Lightspeed companies", len(companies))
        for c in companies[:5]:
            log.info("  %s | stage=%s | year=%s", c["name"], c["stage"], c["year_partnered"])
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", LIGHTSPEED_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            if not c["name"]:
                skipped += 1
                continue
            company_id = upsert_company(sb, c["name"], None, None)
            stage_label = _LIGHTSPEED_STAGE_MAP.get(c["stage"].lower())
            get_or_create_portfolio_investment(sb, org_id, company_id, stage_label or c["stage"] or None, c["year_partnered"])
            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d Lightspeed companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing Lightspeed company %r, skipping", c.get("name"))
            skipped += 1

    log.info("Lightspeed companies done: %d inserted/updated, %d skipped", inserted, skipped)


def _lightspeed_parse_team_grid(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    members = []
    for card in soup.select("a.teamcard"):
        name_el = card.select_one(".text-primary-link--bold")
        detail_el = card.select_one(".text-details--reg .text-details--reg") or card.select_one(".text-details--reg")
        if not name_el or not detail_el:
            continue
        role = detail_el.get_text(strip=True).split("//")[0].strip()
        members.append({
            "name": name_el.get_text(strip=True),
            "role": role,
            "profile_url": card.get("href"),
        })
    return members


def _lightspeed_fetch_bio_and_socials(profile_url: str) -> tuple[str | None, str | None, str | None]:
    """Fetch a team-member page (plain HTTP works here, unlike /company/ pages)
    and pull bio paragraphs + personal LinkedIn/Twitter. The bio is every
    unique <p> in main up to the legal disclaimer paragraph -- the page
    repeats the first paragraph once in a hidden duplicate node."""
    req = urllib.request.Request(profile_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        page_html = resp.read().decode("utf-8", errors="ignore")
    soup = BeautifulSoup(page_html, "html.parser")

    paragraphs, seen = [], set()
    for p in soup.select("main p"):
        parent_class = " ".join(p.parent.get("class") or [])
        if "disclaimer" in parent_class:
            break
        text = p.get_text(strip=True)
        if not text or text in seen:
            continue
        seen.add(text)
        paragraphs.append(text)
    bio = "\n\n".join(paragraphs) or None

    linkedin_url, twitter_url = None, None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "linkedin.com/in/" in href and not linkedin_url:
            linkedin_url = href
        elif ("twitter.com/" in href or "x.com/" in href) and "lightspeed" not in href.lower() and not twitter_url:
            twitter_url = href

    return bio, linkedin_url, twitter_url


def scrape_lightspeed_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Lightspeed's investing team from the team grid (name, role), then
    visit each member's own profile page for bio + LinkedIn/Twitter (not in
    the grid itself). Writes: organization, contacts (bio/LinkedIn/role).
    No structured verticals are published here (unlike a16z), so vertical
    inference for these contacts falls back to bio-embedding matching.
    """
    org_name = "Lightspeed"
    entity_type = "Multi-Stage VC"

    log.info("Fetching Lightspeed team page")
    page_html = fetch_rendered_html(LIGHTSPEED_TEAM_URL)
    all_members = _lightspeed_parse_team_grid(page_html)
    investing = [m for m in all_members if _lightspeed_is_investing_role(m["role"])]
    log.info("Found %d investing team members (of %d total)", len(investing), len(all_members))

    if limit:
        investing = investing[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Lightspeed contacts", len(investing))
        for m in investing:
            log.info("  %s | %s", m["name"], m["role"])
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, LIGHTSPEED_BASE)

    for member in investing:
        try:
            name = member["name"].strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)

            bio, linkedin_url, twitter_url = None, None, None
            if member["profile_url"]:
                try:
                    bio, linkedin_url, twitter_url = _lightspeed_fetch_bio_and_socials(member["profile_url"])
                except Exception:
                    log.warning("Could not fetch profile for %s at %s", name, member["profile_url"])
                time.sleep(CRAWL_DELAY_SECONDS)

            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=None,
                role=member["role"] or None,
                linkedin_url=linkedin_url,
                other_sites={"twitter": twitter_url} if twitter_url else None,
            )
            log.info("Wrote %s | %s | bio=%s", name, member["role"], bool(bio))
        except Exception:
            log.exception("Failed writing Lightspeed contact %r, skipping", member.get("name"))


# ---------------------------------------------------------------------------
# GV (Google Ventures)
# ---------------------------------------------------------------------------

GV_BASE = "https://www.gv.com"
_GV_API = f"{GV_BASE}/api/cms/query"


def _gv_api_fetch_all(query_type: str, sort_field: str = "firstName", page_size: int = 100) -> list[dict]:
    """Paginate through the GV Sanity CMS API for a given content type."""
    from urllib.parse import quote as _urlencode
    import html as _html
    items: list[dict] = []
    skip = 0
    while True:
        opts = {"sort": sort_field, "skip": skip, "limit": page_size}
        url = f"{_GV_API}?type={query_type}&opts={_urlencode(_json.dumps(opts))}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = _json.loads(resp.read())
        items.extend(data["items"])
        if skip + page_size >= data["total"]:
            break
        skip += page_size
        time.sleep(0.3)
    return items


def _flatten_gv_bio(bio_blocks: list[dict] | None) -> str | None:
    """Flatten Sanity portable-text blocks to a plain string."""
    paragraphs: list[str] = []
    for block in (bio_blocks or []):
        if block.get("_type") != "block":
            continue
        text = " ".join(
            child.get("text", "")
            for child in (block.get("children") or [])
            if isinstance(child, dict)
        ).strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs) or None


def _get_or_create_contact_vertical(sb: Client, contact_id: str, vertical_id: str) -> None:
    existing = (
        sb.table("contact_verticals")
        .select("id")
        .eq("contact_id", contact_id)
        .eq("vertical_id", vertical_id)
        .execute()
    )
    if existing.data:
        return
    sb.table("contact_verticals").insert(
        {"contact_id": contact_id, "vertical_id": vertical_id}
    ).execute()


def scrape_gv_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape GV (Google Ventures) investing team from their Sanity CMS API.
    Writes: organization, contacts (bio/LinkedIn/role), contact_verticals (sectors).
    Only includes 'Investing Team' members — skips Ops, Advisors, and unassigned.
    """
    import html as _html

    org_name = "GV"
    entity_type = "Multi-Stage VC"

    log.info("Fetching GV team members from CMS API")
    all_members = _gv_api_fetch_all("teamMember")
    investing = [m for m in all_members if "Investing Team" in (m.get("team") or [])]
    log.info("Found %d investing team members (of %d total)", len(investing), len(all_members))

    if limit:
        investing = investing[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d GV contacts", len(investing))
        for m in investing:
            log.info("  %s | %s | linkedin=%s | sectors=%s",
                     m.get("fullName"), m.get("jobTitle"),
                     bool(m.get("linkedin")), m.get("sector"))
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, GV_BASE)

    for member in investing:
        try:
            raw_name = (member.get("fullName") or "").strip()
            name = _html.unescape(raw_name)
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)
            bio = _flatten_gv_bio(member.get("bio"))
            update_contact_profile(
                sb, contact_id,
                bio=bio,
                email=None,
                role=member.get("jobTitle") or None,
                linkedin_url=member.get("linkedin") or None,
                other_sites=None,
            )
            for sector in (member.get("sector") or []):
                sector = sector.strip()
                if not sector:
                    continue
                vertical_id = get_or_create_vertical(sb, sector)
                _get_or_create_contact_vertical(sb, contact_id, vertical_id)
            log.info("Wrote %s | %s | sectors=%s", name, member.get("jobTitle"), member.get("sector"))
        except Exception:
            log.exception("Failed writing GV contact %r, skipping", member.get("fullName"))


def scrape_gv_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape GV portfolio companies and link them to GV investors.
    Writes: companies, portfolio_investments, contact_investments.
    Requires scrape_gv_team to have been run first.
    """
    import html as _html

    org_name = "GV"

    log.info("Fetching GV portfolio companies from CMS API")
    companies = _gv_api_fetch_all("company", sort_field="name")
    log.info("Found %d GV portfolio companies", len(companies))

    # Rebuild CMS ID → (first, last) from the team API so we can resolve investor refs
    log.info("Fetching GV team to resolve investor references")
    all_members = _gv_api_fetch_all("teamMember")
    cms_id_to_name: dict[str, tuple[str, str]] = {}
    for m in all_members:
        if "Investing Team" not in (m.get("team") or []):
            continue
        raw_name = _html.unescape((m.get("fullName") or "").strip())
        if not raw_name:
            continue
        parts = raw_name.split(" ", 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        cms_id_to_name[m["_id"]] = (first, last)

    org_res = sb.table("organizations").select("id").eq("name", org_name).execute()
    if not org_res.data:
        log.error("GV organization not found in DB — run 'team gv' first")
        return
    org_id = org_res.data[0]["id"]

    contacts_res = sb.table("contacts").select("id, first_name, last_name").eq("org_id", org_id).execute()
    name_to_contact_id: dict[tuple[str, str], str] = {
        (r["first_name"], r["last_name"]): r["id"]
        for r in (contacts_res.data or [])
    }
    log.info("Loaded %d GV contacts from DB for cross-referencing", len(name_to_contact_id))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d GV companies", len(companies))
        return

    inserted = 0
    for co in companies:
        try:
            co_name = (co.get("name") or "").strip()
            if not co_name:
                continue
            co_website = co.get("website") or None
            company_id = upsert_company(sb, co_name, co_website, None)
            get_or_create_portfolio_investment(sb, org_id, company_id, None)

            for inv_ref in (co.get("investors") or []):
                cms_id = inv_ref.get("_ref")
                if not cms_id:
                    continue
                name_parts = cms_id_to_name.get(cms_id)
                if not name_parts:
                    continue
                contact_id = name_to_contact_id.get(name_parts)
                if not contact_id:
                    continue
                get_or_create_contact_investment(sb, contact_id, company_id, "current", None)

            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d GV companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing GV company %r, skipping", co.get("name"))

    log.info("GV companies done: %d processed", inserted)


# ---------------------------------------------------------------------------
# Bessemer Venture Partners (BVP)
# ---------------------------------------------------------------------------
# The richest source of any firm scraped so far: bvp.com/portfolio
# server-renders every portfolio company as a self-contained <article
# class="box investment"> card (521 of them, one per company, no duplicates)
# that already carries description, website, sector tags, founded/partnered
# years, AND the names of the specific BVP partners tied to that company --
# no per-company page visits needed at all, and a plain HTTP GET returns the
# full grid (confirmed: no JS rendering required). The page's own "420+
# portfolio companies" copy undercounts the true total (521) -- just
# marketing rounding, not a discrepancy worth chasing.
#
# There's no funding-round vocabulary published (no "Series A" style field),
# only "Founded" and "Partnered" years, so investment_stage is left null
# here; "Partnered" maps to year_partnered.
#
# Because each company card already names its BVP investors (with links to
# their own bvp.com/team/<slug> profile), we get genuine per-deal
# attribution for free -- contact_investments rows are written directly from
# the companies scrape (stub contacts if the team scrape hasn't run yet; the
# team scrape below fills in role/bio/LinkedIn for the same org+name pair
# afterward via the same idempotent get_or_create_contact() used elsewhere).
#
# The team page (bvp.com/team) is also plain-HTTP-GET-able and exposes a
# clean data-types attribute per card ("investor" / "operations" /
# "operating_advisor") -- the cleanest investing-role filter of any firm
# scraped so far, no keyword heuristics needed. Bios/role/LinkedIn require
# one visit per profile page (also plain HTTP GET, no Playwright).

BVP_BASE = "https://www.bvp.com"
BVP_PORTFOLIO_URL = f"{BVP_BASE}/portfolio"
BVP_TEAM_URL = f"{BVP_BASE}/team"


def _bvp_fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _bvp_parse_companies(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    companies = []
    for card in soup.select("article.investment"):
        name_el = card.select_one(".company .name a")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)

        # A ticker (NASDAQ: X) or "ACQUIRED BY"/"MERGED WITH" badge means this
        # is an exit, not an active portfolio company -- mirrors the
        # current/previous relationship vocabulary used for every other firm.
        enduring_el = card.select_one(".company .enduring-text")
        exit_note = enduring_el.get_text(strip=True) if enduring_el else None

        sectors = [a.get_text(strip=True) for a in card.select(".main-meta a.roadmap")]

        details = card.select_one(".details .content")
        description = None
        website = None
        investors: list[str] = []
        year_partnered = None
        if details:
            intro = details.select_one(".intro")
            if intro:
                description = intro.get_text(" ", strip=True) or None

            cta = details.select_one(".ctas a.cta")
            if cta and cta.get("href"):
                website = cta["href"]

            for a in details.select(".meta .investors a.team"):
                investor_name = a.get_text(strip=True)
                if investor_name:
                    investors.append(investor_name)

            partnered_el = details.select_one(".meta .partnered .year")
            if partnered_el and partnered_el.get_text(strip=True).isdigit():
                year_partnered = int(partnered_el.get_text(strip=True))

        companies.append({
            "name": name,
            "description": description,
            "website": website,
            "sectors": sectors,
            "investors": investors,
            "year_partnered": year_partnered,
            "exit_note": exit_note,
        })
    return companies


def scrape_bvp_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Bessemer Venture Partners' portfolio grid. Writes: companies
    (name, website, description), portfolio_investments (year_partnered
    only -- no stage vocabulary is published), vertical_focus (from each
    company's sector tags), contacts + contact_investments (from the named
    BVP investors on each company card -- genuine per-deal attribution,
    relationship set to "previous" when a ticker/"acquired by" badge marks
    the company as an exit, "current" otherwise).
    """
    org_name = "Bessemer Venture Partners"

    log.info("Fetching BVP portfolio page")
    page_html = _bvp_fetch(BVP_PORTFOLIO_URL)
    companies = _bvp_parse_companies(page_html)
    log.info("Found %d BVP portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d BVP companies", len(companies))
        for c in companies[:5]:
            log.info("  %s | sectors=%s | year=%s | investors=%s | website=%s",
                     c["name"], c["sectors"], c["year_partnered"], c["investors"], c["website"])
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", BVP_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            name = c["name"].strip()
            if not name:
                skipped += 1
                continue
            company_id = upsert_company(sb, name, c["website"], c["description"])
            if not c["description"]:
                log.warning("%s: no description found on site, inserted with null description", name)

            get_or_create_portfolio_investment(sb, org_id, company_id, None, c["year_partnered"])

            relationship = "previous" if c["exit_note"] else "current"
            for investor_name in c["investors"]:
                contact_id = get_or_create_contact(sb, org_id, investor_name)
                get_or_create_contact_investment(sb, contact_id, company_id, relationship, c["exit_note"])

            for sector in c["sectors"]:
                vertical_id = get_or_create_vertical(sb, sector)
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
            if inserted % 100 == 0:
                log.info("Processed %d/%d BVP companies", inserted, len(companies))
        except Exception:
            log.exception("Failed processing BVP company %r, skipping", c.get("name"))
            skipped += 1

    log.info("BVP companies done: %d inserted/updated, %d skipped", inserted, skipped)


_BVP_INVESTING_DATA_TYPES = {"investor"}


def _bvp_parse_team_grid(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    members = []
    for card in soup.select("a.box.team-member"):
        if card.get("data-types") not in _BVP_INVESTING_DATA_TYPES:
            continue
        name_el = card.select_one(".name")
        href = card.get("href")
        if not name_el or not href:
            continue
        members.append({
            "name": name_el.get_text(strip=True),
            "profile_url": href,
        })
    return members


def _bvp_fetch_bio(profile_url: str) -> dict:
    page_html = _bvp_fetch(profile_url)
    soup = BeautifulSoup(page_html, "html.parser")

    role_el = soup.select_one(".bio-details .role")
    role = role_el.get_text(strip=True) if role_el else None

    bio = None
    bio_container = soup.select_one(".bio-text")
    if bio_container:
        paragraphs = [p.get_text(" ", strip=True) for p in bio_container.find_all("p")]
        bio = "\n\n".join(p for p in paragraphs if p) or None

    linkedin_url = None
    for a in soup.select(".social a.social-icon.linkedin"):
        if a.get("href"):
            linkedin_url = a["href"]
            break

    return {"role": role, "bio": bio, "linkedin_url": linkedin_url}


def scrape_bvp_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape BVP's investing team (team page filtered to data-types="investor"
    cards -- operations/operating_advisor staff excluded), then visit each
    member's own profile page for role/bio/LinkedIn. Writes: organization,
    contacts (bio/role/LinkedIn). Contacts may already be stubbed in by
    scrape_bvp_companies() via the per-company investor links; this fills in
    the rest of their profile on the same org+name row.
    """
    org_name = "Bessemer Venture Partners"
    entity_type = "Multi-Stage VC"

    log.info("Fetching BVP team page")
    page_html = _bvp_fetch(BVP_TEAM_URL)
    members = _bvp_parse_team_grid(page_html)
    log.info("Found %d BVP investing team members", len(members))

    if limit:
        members = members[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d BVP contacts", len(members))
        for m in members[:5]:
            log.info("  %s | %s", m["name"], m["profile_url"])
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, BVP_BASE)

    for member in members:
        try:
            name = member["name"].strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)

            profile: dict = {}
            if member["profile_url"]:
                try:
                    profile = _bvp_fetch_bio(member["profile_url"])
                except Exception:
                    log.warning("Could not fetch profile for %s at %s", name, member["profile_url"])
                time.sleep(CRAWL_DELAY_SECONDS)

            update_contact_profile(
                sb, contact_id,
                bio=profile.get("bio"),
                email=None,
                role=profile.get("role"),
                linkedin_url=profile.get("linkedin_url"),
                other_sites=None,
            )
            log.info("Wrote %s | %s | bio=%s", name, profile.get("role"), bool(profile.get("bio")))
        except Exception:
            log.exception("Failed writing BVP contact %r, skipping", member.get("name"))


# ---------------------------------------------------------------------------
# Khosla Ventures
# ---------------------------------------------------------------------------
# The portfolio page (khoslaventures.com/portfolio) is a Webflow site whose
# company grid is populated client-side into Splide carousels (needs
# fetch_rendered_html, unlike the team page below) -- one carousel per
# sector, e.g. "Consumer & Retail", "Fintech", "Digital Health". Each
# carousel renders every real card twice for its infinite-loop effect (same
# clone-duplication shape as ICONIQ's grid), so companies are deduped by
# href within each sector section (confirmed no company appears in more
# than one sector's section). This is a curated "spotlight" page (132
# unique companies after dedup, no "view all" link found anywhere) rather
# than Khosla's full portfolio history -- same kind of curated-subset
# scope decision as other firms' sparser sources. Each card gives name,
# external website (the card's own href), and a one-line tagline (used as
# description) -- no stage or year-partnered data is published here.
#
# The team page (khoslaventures.com/team) is plain-HTTP-GET-able (both the
# grid and each /team/<slug> bio page) and is divided into four named
# category sections via in-page anchors: "Managing Directors", "Investors",
# "Operators", "Platform". Only the first two are genuinely investing-track
# (mirrors BVP's investor/operating_advisor split) -- Operators/Platform are
# operational support staff, excluded. No role field is given directly;
# each bio's opening sentence reliably reads "<Name> is a/an <ROLE> at
# Khosla Ventures" (confirmed against several profiles), so role is
# regex-extracted from there, falling back to a generic label derived from
# the category section if a bio doesn't match that phrasing.

KHOSLA_BASE = "https://www.khoslaventures.com"
KHOSLA_PORTFOLIO_URL = f"{KHOSLA_BASE}/portfolio"
KHOSLA_TEAM_URL = f"{KHOSLA_BASE}/team"

_KHOSLA_INVESTING_CATEGORY_IDS = {
    "managing-directors": "Managing Director",
    "investors": "Investor",
}

_KHOSLA_ROLE_RE = re.compile(r"^\S+\s+is an?\s+(.+?)\s+at Khosla Ventures\b")


def _khosla_fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _khosla_name_from_website(website: str) -> str | None:
    """
    Fallback for the ~90% of cards whose <img alt> is empty (confirmed not a
    lazy-load timing issue -- re-fetching with a full-page scroll to force
    every image to load didn't change the empty-alt count) and whose CDN
    asset filenames are too inconsistently formatted to regex-parse a name
    out of reliably (mix of "KV_Highlight-Name.svg", "Name.avif",
    "KVPortfolio_Category-Name-White-1.svg", etc.). The company's own
    website domain is always present and gives an imperfect-but-safe name
    (e.g. "ringcentral.com" -> "Ringcentral", losing internal caps) rather
    than silently dropping ~90% of the portfolio.
    """
    netloc = urlparse(website).netloc
    labels = netloc.split(".") if netloc else []
    # Skip generic subdomain prefixes that aren't the brand itself (e.g.
    # "about.gitlab.com" should yield "Gitlab", not "About"). Left as a
    # short blocklist rather than a full public-suffix-list dependency --
    # only 1 of Khosla's 132 companies hit this case.
    generic_prefixes = {"www", "about", "blog", "app", "shop", "my", "join", "use", "try", "get"}
    while len(labels) > 2 and labels[0] in generic_prefixes:
        labels = labels[1:]
    label = labels[0] if labels else ""
    if not label:
        return None
    words = re.split(r"[-_]", label)
    return " ".join(w.capitalize() for w in words if w) or None


def _khosla_parse_companies(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    sections = soup.select("section.grid")

    companies = []
    pending_category = None
    for section in sections:
        title_el = section.select_one(".slider-title")
        if title_el:
            pending_category = title_el.get_text(strip=True)
            continue

        cards = section.select(".company-slide")
        if not cards or not pending_category:
            continue

        seen_hrefs = set()
        for card in cards:
            href = card.get("href")
            if not href or href in seen_hrefs:
                continue
            seen_hrefs.add(href)

            img = card.select_one("img")
            alt_name = (img.get("alt") or "").strip() if img else ""
            name = alt_name or _khosla_name_from_website(href) or ""
            tagline_el = card.select_one(".text-block-17")
            tagline = tagline_el.get_text(strip=True) if tagline_el else None

            companies.append({
                "name": name,
                "website": href,
                "description": tagline,
                "category": pending_category,
            })
        pending_category = None

    return companies


def scrape_khosla_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Khosla Ventures' portfolio spotlight page (per-sector Splide
    carousels). Writes: companies (name, website, description -- the
    card's one-line tagline), portfolio_investments (no stage/year
    published), vertical_focus (from each company's sector section).
    """
    org_name = "Khosla Ventures"

    log.info("Fetching Khosla Ventures portfolio page (rendered)")
    page_html = fetch_rendered_html(KHOSLA_PORTFOLIO_URL)
    companies = _khosla_parse_companies(page_html)
    log.info("Found %d Khosla Ventures portfolio companies", len(companies))

    if limit:
        companies = companies[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Khosla Ventures companies", len(companies))
        for c in companies[:5]:
            log.info("  %s | category=%s | website=%s | tagline=%s",
                     c["name"], c["category"], c["website"], c["description"])
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", KHOSLA_BASE)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            name = c["name"].strip()
            if not name:
                log.warning("Skipping a company with no name and no website to derive one from (%r)", c.get("website"))
                skipped += 1
                continue
            company_id = upsert_company(sb, name, c["website"], c["description"])
            if not c["description"]:
                log.warning("%s: no tagline found on site, inserted with null description", name)

            get_or_create_portfolio_investment(sb, org_id, company_id, None, None)

            if c["category"]:
                vertical_id = get_or_create_vertical(sb, c["category"])
                get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
        except Exception:
            log.exception("Failed processing Khosla Ventures company %r, skipping", c.get("name"))
            skipped += 1

    log.info("Khosla Ventures companies done: %d inserted/updated, %d skipped", inserted, skipped)


def _khosla_parse_team_grid(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    members = []
    for section in soup.select("section.category-section"):
        category_id = section.get("id")
        fallback_role = _KHOSLA_INVESTING_CATEGORY_IDS.get(category_id)
        if not fallback_role:
            continue
        for card in section.select(".team-member-item"):
            a = card.select_one("a[href]")
            name_el = card.select_one(".team-member-name")
            if not a or not name_el:
                continue
            members.append({
                "name": name_el.get_text(strip=True),
                "profile_url": f"{KHOSLA_BASE}{a['href']}",
                "fallback_role": fallback_role,
            })
    return members


def _khosla_fetch_bio(profile_url: str, fallback_role: str) -> dict:
    page_html = _khosla_fetch(profile_url)
    soup = BeautifulSoup(page_html, "html.parser")

    paragraphs = [p.get_text(" ", strip=True) for p in soup.select(".rich-text-blog p")]
    bio = "\n\n".join(p for p in paragraphs if p) or None

    role = fallback_role
    if paragraphs:
        m = _KHOSLA_ROLE_RE.match(paragraphs[0])
        if m:
            role = m.group(1)

    linkedin_url = None
    for a in soup.select(".div-block-25 a[href]"):
        if "linkedin.com/in/" in a["href"]:
            linkedin_url = a["href"]
            break

    return {"role": role, "bio": bio, "linkedin_url": linkedin_url}


def scrape_khosla_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Khosla Ventures' investing team (Managing Directors + Investors
    category sections on the team page -- Operators/Platform excluded as
    non-investing), then visit each member's own profile page for bio,
    role (regex-extracted from the bio's opening sentence, falling back to
    a generic category label), and LinkedIn. Writes: organization,
    contacts (bio/role/LinkedIn).
    """
    org_name = "Khosla Ventures"
    entity_type = "Multi-Stage VC"

    log.info("Fetching Khosla Ventures team page")
    page_html = _khosla_fetch(KHOSLA_TEAM_URL)
    members = _khosla_parse_team_grid(page_html)
    log.info("Found %d Khosla Ventures investing team members", len(members))

    if limit:
        members = members[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Khosla Ventures contacts", len(members))
        for m in members[:5]:
            log.info("  %s | %s", m["name"], m["profile_url"])
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, KHOSLA_BASE)

    for member in members:
        try:
            name = member["name"].strip()
            if not name:
                continue
            contact_id = get_or_create_contact(sb, org_id, name)

            profile: dict = {}
            if member["profile_url"]:
                try:
                    profile = _khosla_fetch_bio(member["profile_url"], member["fallback_role"])
                except Exception:
                    log.warning("Could not fetch profile for %s at %s", name, member["profile_url"])
                time.sleep(CRAWL_DELAY_SECONDS)

            update_contact_profile(
                sb, contact_id,
                bio=profile.get("bio"),
                email=None,
                role=profile.get("role"),
                linkedin_url=profile.get("linkedin_url"),
                other_sites=None,
            )
            log.info("Wrote %s | %s | bio=%s", name, profile.get("role"), bool(profile.get("bio")))
        except Exception:
            log.exception("Failed writing Khosla Ventures contact %r, skipping", member.get("name"))


# ---------------------------------------------------------------------------
# Ribbit Capital
# ---------------------------------------------------------------------------
# The sparsest source scraped so far, confirmed deliberately (not a
# rendering bug): both ribbitcap.com/rebels (portfolio) and
# ribbitcap.com/team are plain-HTTP-GET-able and fully server-rendered
# (matches the CSV's own note: "the company and who owns it is on this
# page but there is no company description"), but neither has ANY other
# field -- no website, no sector/stage, no per-person href/role/bio
# anywhere, and clicking a row (checked via Playwright on both pages) only
# toggles a CSS selection state, no modal or API call. 149 unique
# companies, 34 team members, both plain name lists.
#
# Each portfolio row's second column looked at first like Ribbit's own
# deal partners, but cross-checking initials against the team roster gives
# zero matches -- e.g. Affirm's row lists "Max L., Nathan G., Jeffrey K.,
# Alex R.", which are that company's own founders (Max Levchin, Nathan
# Gettings, Jeffrey Kaditz, Alex Rampell), not Ribbit staff. There's no
# "founders" field in this schema's companies table and contacts/
# contact_investments are specifically Ribbit's own team elsewhere in this
# file, so writing these names there would misattribute someone else's
# founders as Ribbit employees -- deliberately not scraped.
#
# No role/title exists anywhere on the team page either, so every contact
# is written with role=None (no investing-vs-operating split is possible
# here, unlike every other firm scraped so far).

RIBBIT_BASE = "https://www.ribbitcap.com"
RIBBIT_PORTFOLIO_URL = f"{RIBBIT_BASE}/rebels"
RIBBIT_TEAM_URL = f"{RIBBIT_BASE}/team"


def _ribbit_fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _ribbit_parse_row_names(page_html: str) -> list[str]:
    soup = BeautifulSoup(page_html, "html.parser")
    names = []
    for row in soup.select('div.w-full.flex.flex-row.gap-4[data-type="scrollable-list-item"]'):
        name_el = row.select_one("span.truncate")
        if name_el:
            names.append(name_el.get_text(strip=True))
    return names


def scrape_ribbit_companies(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Ribbit Capital's portfolio list (name only -- no description,
    website, sector, or stage is published anywhere on the source page).
    Writes: companies (name), portfolio_investments (no stage/year).
    """
    org_name = "Ribbit Capital"

    log.info("Fetching Ribbit Capital portfolio page")
    page_html = _ribbit_fetch(RIBBIT_PORTFOLIO_URL)
    names = _ribbit_parse_row_names(page_html)
    log.info("Found %d Ribbit Capital portfolio companies", len(names))

    if limit:
        names = names[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Ribbit Capital companies", len(names))
        for n in names[:5]:
            log.info("  %s", n)
        return

    org_id = get_or_create_organization(sb, org_name, "Multi-Stage VC", RIBBIT_BASE)

    inserted, skipped = 0, 0
    for name in names:
        try:
            name = name.strip()
            if not name:
                skipped += 1
                continue
            company_id = upsert_company(sb, name, None, None)
            get_or_create_portfolio_investment(sb, org_id, company_id, None, None)
            inserted += 1
        except Exception:
            log.exception("Failed processing Ribbit Capital company %r, skipping", name)
            skipped += 1

    log.info("Ribbit Capital companies done: %d inserted/updated, %d skipped", inserted, skipped)


def scrape_ribbit_team(sb: Client, dry_run: bool = False, limit: int | None = None) -> None:
    """
    Scrape Ribbit Capital's team roster (name only -- no role, bio, or
    LinkedIn is published anywhere on the source page, and no investing-
    vs-operating distinction is possible). Writes: organization, contacts.
    """
    org_name = "Ribbit Capital"
    entity_type = "Multi-Stage VC"

    log.info("Fetching Ribbit Capital team page")
    page_html = _ribbit_fetch(RIBBIT_TEAM_URL)
    names = _ribbit_parse_row_names(page_html)
    log.info("Found %d Ribbit Capital team members", len(names))

    if limit:
        names = names[:limit]

    if dry_run:
        log.info("[DRY-RUN] Would write %d Ribbit Capital contacts", len(names))
        for n in names[:5]:
            log.info("  %s", n)
        return

    org_id = get_or_create_organization(sb, org_name, entity_type, RIBBIT_BASE)

    for name in names:
        try:
            name = name.strip()
            if not name:
                continue
            get_or_create_contact(sb, org_id, name)
            log.info("Wrote %s", name)
        except Exception:
            log.exception("Failed writing Ribbit Capital contact %r, skipping", name)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def scrape_firm(sb: Client, firm_key: str) -> None:
    firm = FIRM_REGISTRY[firm_key]
    log.info("Fetching %s (%s)", firm["name"], firm["url"])
    fetch_fn = firm.get("fetch_fn", fetch_rendered_html)
    html = fetch_fn(firm["url"])

    companies = firm["parser"](html)
    log.info("Parsed %d companies from %s", len(companies), firm["name"])

    parsed = urlparse(firm["url"])
    homepage = f"{parsed.scheme}://{parsed.netloc}/"
    org_id = get_or_create_organization(sb, firm["name"], firm["entity_type"], homepage)

    inserted, skipped = 0, 0
    for c in companies:
        try:
            if not c["name"]:
                log.warning("Skipping a company with no name (missing logo alt/id)")
                skipped += 1
                continue

            company_id = upsert_company(sb, c["name"], c["website"], c["description"])
            if not c["description"]:
                log.warning("%s: no description found on site, inserted with null description", c["name"])

            get_or_create_portfolio_investment(sb, org_id, company_id, c["stage"], c.get("year_partnered"))

            if not c["investors"]:
                log.warning("%s: no partner/investor listed, skipping contact linkage", c["name"])
            for investor_name in c["investors"]:
                get_or_create_contact(sb, org_id, investor_name)

            if c["domain"]:
                for tag in [t.strip() for t in c["domain"].split(",") if t.strip()]:
                    vertical_id = get_or_create_vertical(sb, tag)
                    get_or_create_vertical_focus(sb, org_id, vertical_id)

            inserted += 1
        except Exception:
            log.exception("Failed to process company %r, skipping", c.get("name"))
            skipped += 1

    log.info("%s done: %d companies inserted/updated, %d skipped", firm["name"], inserted, skipped)


TEAM_SCRAPERS = {
    "greylock": scrape_greylock_team,
    "sequoia": scrape_sequoia_team,
    "accel": scrape_accel_team,
    "yc": scrape_yc_partners,
    "tribeca": scrape_tribeca_team,
    "avvc": scrape_av_vc_team,
    "gv": scrape_gv_team,
    "a16z": scrape_a16z_team,
    "lightspeed": scrape_lightspeed_team,
    "foundersfund": scrape_foundersfund_team,
    "kleinerperkins": scrape_kleinerperkins_team,
    "nea": scrape_nea_team,
    "bvp": scrape_bvp_team,
    "khosla": scrape_khosla_team,
    "ribbit": scrape_ribbit_team,
}

COMPANIES_SCRAPERS = {
    "yc": scrape_yc_companies,
    "tribeca": scrape_tribeca_companies,
    "avvc": scrape_av_vc_companies,
    "a16z": scrape_a16z_companies,
    "lightspeed": scrape_lightspeed_companies,
    "gv": scrape_gv_companies,
    "foundersfund": scrape_foundersfund_companies,
    "kleinerperkins": scrape_kleinerperkins_companies,
    "iconiq": scrape_iconiq_companies,
    "nea": scrape_nea_companies,
    "bvp": scrape_bvp_companies,
    "khosla": scrape_khosla_companies,
    "ribbit": scrape_ribbit_companies,
}


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(
        description="Scrape VC firm portfolio and team data into Supabase.",
        usage="%(prog)s [team] [firm ...] [--dry-run] [--limit N]",
    )
    ap.add_argument("positional", nargs="*", help="'team' then firm keys, or just firm keys")
    ap.add_argument("--dry-run", action="store_true",
                    help="Fetch and parse but write nothing to the database")
    ap.add_argument("--limit", type=int, default=None, metavar="N",
                    help="Process at most N profiles (useful for testing a new parser)")
    opts = ap.parse_args()

    dry_run: bool = opts.dry_run
    limit: int | None = opts.limit
    positional: list[str] = opts.positional

    if dry_run:
        log.info("=== DRY-RUN MODE — no database writes will occur ===")

    sb = get_supabase()

    if positional and positional[0] == "team":
        firm_keys = positional[1:] or list(TEAM_SCRAPERS.keys())
        for firm_key in firm_keys:
            if firm_key not in TEAM_SCRAPERS:
                log.error("No team scraper for %r. Available: %s", firm_key, list(TEAM_SCRAPERS.keys()))
                continue
            TEAM_SCRAPERS[firm_key](sb, dry_run=dry_run, limit=limit)
        return

    if positional and positional[0] == "companies":
        firm_keys = positional[1:] or list(COMPANIES_SCRAPERS.keys())
        for firm_key in firm_keys:
            if firm_key not in COMPANIES_SCRAPERS:
                log.error("No companies scraper for %r. Available: %s", firm_key, list(COMPANIES_SCRAPERS.keys()))
                continue
            COMPANIES_SCRAPERS[firm_key](sb, dry_run=dry_run, limit=limit)
        return

    firm_keys = positional or list(FIRM_REGISTRY.keys())
    for i, firm_key in enumerate(firm_keys):
        if firm_key not in FIRM_REGISTRY:
            log.error("Unknown firm %r. Available: %s", firm_key, list(FIRM_REGISTRY.keys()))
            continue
        scrape_firm(sb, firm_key)
        if i < len(firm_keys) - 1:
            time.sleep(CRAWL_DELAY_SECONDS)


if __name__ == "__main__":
    main()
