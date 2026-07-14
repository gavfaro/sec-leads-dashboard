"""
Dump Accel team listing and one partner profile so we can see the real DOM structure
before writing the actual parser.

Run: python investor_scraper/debug_accel.py
"""
import re
import sys
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

TEAM_URL = "https://www.accel.com/team"


def fetch(url: str, wait_ms: int = 5000) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page.goto(url, wait_until="load", timeout=90000)
        page.wait_for_timeout(wait_ms)
        html = page.content()
        ctx.close()
        browser.close()
    return html


def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def main() -> None:
    section("FETCHING TEAM LISTING")
    print(f"URL: {TEAM_URL}")
    html = fetch(TEAM_URL)
    soup = BeautifulSoup(html, "html.parser")

    # ── Find tab links (global / us / europe / india / etc.) ──
    section("TAB / FILTER LINKS")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if "team" in href.lower() or any(w in text.lower() for w in ["global", "us", "europe", "india", "all"]):
            print(f"  [{text}] → {href}")

    # ── Find all links that look like person profile pages ──
    section("PERSON PROFILE LINKS (first 15)")
    seen = set()
    profile_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Accel profiles are typically /people/<slug>
        if re.search(r"/(people|team|person)/[\w-]+", href):
            if href not in seen:
                seen.add(href)
                profile_links.append(href)
    for link in profile_links[:15]:
        print(f"  {link}")

    if not profile_links:
        section("NO PROFILE LINKS FOUND — DUMPING ALL <a> HREFS")
        for a in soup.find_all("a", href=True)[:40]:
            print(f"  [{a.get_text(strip=True)[:40]}] → {a['href']}")

    # ── Dump a sample of the team listing HTML to spot card structure ──
    section("FIRST 3000 CHARS OF <main> or <body>")
    main_el = soup.find("main") or soup.find("body")
    if main_el:
        print(main_el.prettify()[:3000])

    # ── Fetch first profile ──
    if not profile_links:
        print("\nNo profile links found — stopping here.")
        sys.exit(1)

    first_profile = profile_links[0]
    if first_profile.startswith("/"):
        first_profile = "https://www.accel.com" + first_profile

    section(f"FETCHING PROFILE: {first_profile}")
    profile_html = fetch(first_profile, wait_ms=4000)
    psoup = BeautifulSoup(profile_html, "html.parser")

    section("PROFILE — <h1>")
    for h in psoup.find_all("h1"):
        print(repr(h.get_text(strip=True)))

    section("PROFILE — ALL <h2> and <h3>")
    for h in psoup.find_all(["h2", "h3"]):
        print(f"  <{h.name}> {repr(h.get_text(strip=True))}")

    section("PROFILE — SPECIALTY / BASED IN / ROLE labels")
    for el in psoup.find_all(string=re.compile(r"SPECIALTY|BASED IN|specialty|based in", re.I)):
        parent = el.parent
        print(f"  tag={parent.name!r}  class={parent.get('class')}  text={el.strip()!r}")
        # Show siblings/neighbors
        for sib in parent.find_next_siblings()[:3]:
            print(f"    next-sibling: <{sib.name}> {sib.get_text(strip=True)!r}")

    section("PROFILE — ABOUT / BIO paragraph")
    for el in psoup.find_all(string=re.compile(r"^About\s+\w", re.I)):
        parent = el.parent
        print(f"  'About' heading: <{parent.name}> class={parent.get('class')}")
        for sib in parent.find_next_siblings(["p", "div"])[:3]:
            txt = sib.get_text(" ", strip=True)
            if txt:
                print(f"    → {txt[:200]!r}")

    section("PROFILE — RELATIONSHIPS section")
    for el in psoup.find_all(string=re.compile(r"RELATIONSHIPS|relationships", re.I)):
        parent = el.parent
        print(f"  'RELATIONSHIPS' el: <{parent.name}> class={parent.get('class')}")
        container = parent.parent
        print(f"  container: <{container.name}> class={container.get('class')}")
        print(container.prettify()[:2000])

    section("PROFILE — ALL <img> alt texts (company logos)")
    for img in psoup.find_all("img"):
        alt = img.get("alt", "").strip()
        src = img.get("src", "")
        if alt and not any(skip in alt.lower() for skip in ["profile", "photo", "avatar", "headshot", "casey", "accel"]):
            print(f"  alt={alt!r}  src={src[:60]!r}")

    section("PROFILE — SOCIAL LINKS (linkedin, twitter, x.com)")
    for a in psoup.find_all("a", href=True):
        href = a["href"]
        if any(s in href for s in ["linkedin.com", "twitter.com", "x.com"]):
            print(f"  {href}")

    section("PROFILE — FULL HTML (first 5000 chars)")
    print(profile_html[:5000])


if __name__ == "__main__":
    main()
