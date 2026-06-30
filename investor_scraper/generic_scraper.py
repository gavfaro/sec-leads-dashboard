"""
Generic portfolio scraper.

Tries strategies in order until one yields results:
  1. API interception  — captures JSON the page fetches (works for many modern VC sites)
  2. Table rows        — like Sequoia's <table> layout
  3. Card/grid         — div/article cards (most common)
  4. Link list         — fallback: extract company names from prominent links
"""

import json
import re
from playwright.sync_api import Page

# CSS selectors tried in order for card-based layouts.
# First match with >= 3 elements wins.
CARD_SELECTORS = [
    "[class*='portfolio-company']",
    "[class*='PortfolioCompany']",
    "[class*='company-card']",
    "[class*='CompanyCard']",
    "[class*='portfolio-item']",
    "[class*='portfolio-entry']",
    "[class*='portfolio-list'] li",
    "[class*='companies-list'] li",
    "[class*='company-grid'] > *",
    "[class*='investment-item']",
    "article[class*='company']",
    "article[class*='portfolio']",
    ".company-item",
    ".portfolio-company",
]

# Name selectors tried within each card element
NAME_SELECTORS = "h2, h3, h4, [class*='name'], [class*='Name'], [class*='title'], strong"
DESC_SELECTORS = "p, [class*='description'], [class*='Description'], [class*='tagline']"
TAG_SELECTORS  = "[class*='stage'], [class*='Stage'], [class*='tag'], [class*='sector'], [class*='category']"


# ── Strategy 1: API interception ─────────────────────────────────────────────

def _looks_like_company_list(obj) -> list | None:
    """
    Return a list of company-like dicts if obj looks like portfolio data,
    otherwise return None.
    """
    if isinstance(obj, list) and len(obj) >= 3:
        sample = obj[0] if obj else {}
        if isinstance(sample, dict):
            keys = {k.lower() for k in sample.keys()}
            name_keys = {"name", "company", "title", "companyname", "company_name"}
            if keys & name_keys:
                return obj
    if isinstance(obj, dict):
        for v in obj.values():
            result = _looks_like_company_list(v)
            if result:
                return result
    return None


def scrape_via_api(page: Page, url: str) -> list[dict]:
    captured = []

    def on_response(response):
        ct = response.headers.get("content-type", "")
        if "json" not in ct:
            return
        try:
            data = response.json()
        except Exception:
            return
        companies = _looks_like_company_list(data)
        if companies:
            captured.extend(companies)

    page.on("response", on_response)
    page.goto(url, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)

    if not captured:
        return []

    results = []
    seen = set()
    for item in captured:
        if not isinstance(item, dict):
            continue
        # Normalise key names
        name = (
            item.get("name") or item.get("company") or item.get("title")
            or item.get("companyName") or item.get("company_name") or ""
        ).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        desc = (
            item.get("description") or item.get("shortDescription")
            or item.get("tagline") or item.get("summary") or ""
        ).strip()
        stage = (item.get("stage") or item.get("round") or item.get("sector") or "").strip()
        results.append({
            "name": name,
            "description": desc,
            "stage": stage,
            "partners": "",
            "first_partnered": str(item.get("year") or item.get("investmentYear") or ""),
            "source_company_id": str(item.get("id") or item.get("slug") or name),
        })

    return results


# ── Strategy 2: Table ─────────────────────────────────────────────────────────

def scrape_via_table(page: Page) -> list[dict]:
    rows = page.eval_on_selector_all(
        "table tr",
        """
        (trs) => trs.map(tr => {
            const tds = Array.from(tr.querySelectorAll('td'));
            return tds.length >= 2 ? tds.map(td => td.innerText.trim()) : null;
        }).filter(Boolean)
        """,
    )
    if not rows:
        return []

    results = []
    seen = set()
    for i, r in enumerate(rows):
        # Heuristic: first column is either a numeric ID or the company name
        if r[0].isdigit():
            source_id, name = r[0], r[1] if len(r) > 1 else ""
            desc     = r[2] if len(r) > 2 else ""
            partners = r[3] if len(r) > 3 else ""
            fp       = r[4] if len(r) > 4 else ""
        else:
            source_id = str(i)
            name, desc = r[0], r[1] if len(r) > 1 else ""
            partners   = r[2] if len(r) > 2 else ""
            fp         = r[3] if len(r) > 3 else ""

        name = name.strip()
        if not name or name in seen or name.lower() in {"company", "name", "portfolio"}:
            continue
        seen.add(name)

        stage_m = re.match(r"^(.*?)\s*\(\d{4}\)", fp)
        stage   = stage_m.group(1).strip() if stage_m else ""

        results.append({
            "name": name,
            "description": desc.strip(),
            "stage": stage,
            "partners": partners.strip(),
            "first_partnered": fp.strip(),
            "source_company_id": source_id,
        })

    return results


# ── Strategy 3: Card/grid ─────────────────────────────────────────────────────

def scrape_via_cards(page: Page) -> list[dict]:
    for selector in CARD_SELECTORS:
        count = page.locator(selector).count()
        if count < 3:
            continue

        items = page.eval_on_selector_all(
            selector,
            f"""
            (els) => els.map((el, i) => {{
                const nameEl = el.querySelector('{NAME_SELECTORS}');
                const descEl = el.querySelector('{DESC_SELECTORS}');
                const tagEl  = el.querySelector('{TAG_SELECTORS}');
                const name   = nameEl ? nameEl.innerText.trim() : null;
                if (!name) return null;
                return {{
                    source_company_id: String(i),
                    name: name,
                    description: descEl ? descEl.innerText.trim() : '',
                    stage: tagEl ? tagEl.innerText.trim() : '',
                    partners: '',
                    first_partnered: '',
                }};
            }}).filter(x => x && x.name)
            """,
        )

        seen = set()
        results = []
        for item in items:
            n = item["name"]
            if n in seen:
                continue
            seen.add(n)
            results.append(item)

        if results:
            return results

    return []


# ── Strategy 4: Link list fallback ────────────────────────────────────────────

def scrape_via_links(page: Page, portfolio_url: str) -> list[dict]:
    """
    Collect all anchor texts from links that look like company sub-pages
    (same origin, path contains /portfolio/ /companies/ /team/ etc.)
    """
    base_domain = re.sub(r"https?://([^/]+).*", r"\1", portfolio_url)
    links = page.eval_on_selector_all(
        "a[href]",
        f"""
        (as) => as.map(a => ({{
            href: a.href,
            text: a.innerText.trim(),
        }})).filter(x =>
            x.text.length > 1 &&
            x.text.length < 80 &&
            x.href.includes('{base_domain}') &&
            /\\/(portfolio|companies|investments|company|co)\\//.test(x.href)
        )
        """,
    )
    seen = set()
    results = []
    for i, lnk in enumerate(links):
        name = lnk["text"]
        if name in seen:
            continue
        seen.add(name)
        results.append({
            "name": name,
            "description": "",
            "stage": "",
            "partners": "",
            "first_partnered": "",
            "source_company_id": lnk["href"],
        })
    return results


# ── Main entry point ──────────────────────────────────────────────────────────

def scrape_firm_portfolio(browser, firm: dict) -> list[dict]:
    """
    Scrape a firm's portfolio page. Returns list of company dicts.
    Tries strategies in order; logs which one worked.
    """
    url = firm["portfolio_url"]
    name = firm["name"]

    from base_scraper import new_stealth_page, scroll_until_stable  # local import to avoid circular

    page, ctx = new_stealth_page(browser)
    try:
        print(f"  [{name}] Loading {url} ...")

        # Strategy 1: intercept API JSON
        results = scrape_via_api(page, url)
        if results:
            print(f"  [{name}] API interception → {len(results)} companies")
            return results

        # Scroll to trigger lazy-loading before parsing DOM
        scroll_until_stable(page)

        # Strategy 2: table
        if page.locator("table td").count() > 0:
            results = scrape_via_table(page)
            if results:
                print(f"  [{name}] Table strategy → {len(results)} companies")
                return results

        # Strategy 3: cards/grid
        results = scrape_via_cards(page)
        if results:
            print(f"  [{name}] Card strategy → {len(results)} companies")
            return results

        # Strategy 4: link list
        results = scrape_via_links(page, url)
        if results:
            print(f"  [{name}] Link fallback → {len(results)} companies")
            return results

        print(f"  [{name}] WARNING: no companies found — may need a custom scraper")
        return []

    except Exception as e:
        print(f"  [{name}] ERROR: {e}")
        return []
    finally:
        ctx.close()
