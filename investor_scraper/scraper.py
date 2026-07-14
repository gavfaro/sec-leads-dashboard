import io
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
