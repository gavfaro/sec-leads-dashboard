# Missing company descriptions — investigation notes

As of 2026-07-26: 657 of 4,413 companies (15%) have no `description`. This directly
weakens the matching engine's text score and vertical inference for those
companies (they fall back to neutral scoring / embedding-based guesses instead of
using real description text).

**This is not evenly spread — it's almost entirely one firm.**

| Firm | Missing / Total portfolio rows | % |
|---|---|---|
| GV (Google Ventures) | 556 / 643 | 86% |
| Y Combinator | 78 / 1086 | 7% |
| Alumni Ventures | 23 / 1718 | 1% |
| Accel | 3 / 500 | 1% |
| **Lightspeed** | **665 / 665** | **100% (deliberate, see below)** |

556 of the original 657 total gaps (85%) were GV alone. Lightspeed adds a whole
new 665-company gap on top of that, added deliberately (not discovered) --
see below, this one's different from the others.

## Root cause per firm

- **GV**: `scrape_gv_companies()` in `scraper.py` (~line 2244) pulls from GV's own
  Sanity CMS API and hardcodes `description=None` when upserting. I checked the
  live API response directly — it's not a scraper bug dropping data that's there.
  A GV company record genuinely looks like:
  ```json
  { "name": "Iterative Health", "sector": {"_ref": "..."}, "website": "https://iterative.health" }
  ```
  No description/tagline/summary field exists in GV's structured company
  directory at all (unlike their team-member API, which does have rich bio text
  that the scraper already extracts correctly).
- **Y Combinator**: `scrape_yc_partners()` (~line 1014) builds each partner's
  "companies I've backed" list from their personal profile page, which is just
  name + URL — no blurb at that source. (YC's own public company directory does
  have descriptions, but that's not what this function scrapes.)
- **Alumni Ventures / Accel**: negligible (1% each) — normal background noise
  where a specific portfolio listing just didn't include a blurb.
- **Lightspeed** (added 2026-07-26): different situation from the others above --
  this wasn't an accidental gap, it was a scope decision. `scrape_lightspeed_companies()`
  parses the server-rendered grid at lsvp.com/companies/, which has real structured
  data per company (stage invested, year backed, status) but **no description and
  no external website at all** -- neither field exists in the grid markup. Both
  only live on each company's own `lsvp.com/company/<slug>/` page (confirmed by
  checking one directly: Anthropic's page has a real description *and* a link to
  anthropic.com). Getting either one means visiting all ~666 individual pages,
  which at this project's established courtesy delay (`CRAWL_DELAY_SECONDS = 10`,
  used everywhere else in scraper.py for per-profile loops) is ~2 hours for
  Lightspeed alone -- too long for one pass, so it was skipped rather than rushed.
  Unlike GV, there's no `website` fallback stored for these either, so the planned
  backfill (below) can't reach Lightspeed's companies via their own site directly;
  it would need an extra hop through `lsvp.com/company/<slug>/` first to discover
  the website, or just pull the description straight from that lsvp.com page
  instead of bothering with the external site at all.

## The fix (not started — deliberately deferred)

We already have `website` for 567 of the original 657 GV/YC/etc. gaps (including
nearly all of GV's). `scraper.py` already has a technique for exactly this, used
for at least one other firm's path (~line 1386): fetch the company's own site and
pull an "about" blurb/meta description as a fallback description. That fallback
was just never wired up for GV (or YC).

**Plan when we pick this up:**
1. Write a standalone backfill script (don't touch the live per-firm scrape
   functions) that reads `companies` where `description is null and website is
   not null`, visits each website, extracts a description (meta description tag
   first, fall back to an "about" page / hero text), and upserts it. This covers
   GV/YC/Alumni Ventures/Accel.
2. Separately, for Lightspeed (no website on file at all): write a small loop
   over `lsvp.com/company/<slug>/` pages (slugs are recoverable from each
   company's `data-company-id` in the portfolio grid) that grabs both the
   external website *and* the description in one visit each, at the standard
   10s courtesy delay. This is the ~2-hour job that got deferred -- run it as
   its own background pass, not inline with other scraping.
3. Re-run `scripts/embed_local.py` afterward so the newly-filled descriptions get
   embedded (they currently have no `company_embeddings` row at all, so they're
   silently invisible to text-score/vertical-inference matching, not just
   neutral-scored).
4. GV is still the priority target for step 1 (556 companies, one well-defined
   batch behind one API). Lightspeed (step 2) is the biggest single chunk overall
   but is its own separate, longer-running job.

## Reference data

`investor_scraper/missing_descriptions.csv` — full list of the 567 GV/YC/etc.
affected companies (id, name, website, which firm(s) they're tied to), generated
2026-07-26, so the backfill script has a ready-made input list instead of
re-deriving it from the DB. Lightspeed isn't in this file since it has no
`website` to backfill from yet (see step 2 above) -- its 665 rows can be found
via `portfolio_investments` joined to `organizations.name = 'Lightspeed'`.

## Related gap: missing `website` (not description)

**NEA** (added 2026-07-26) is the mirror image of the Lightspeed situation:
`scrape_nea_companies()` pulls from `www.nea.com/api/portfolio/companies`, which
has **100% description coverage** (912/912) but no `website` field anywhere in
the payload -- confirmed by checking the raw API response and a slug-specific
query, neither has one. Company websites aren't used for scoring directly, but
they matter for staff actually reaching out, and for the export button's
"Org/Company Website" columns. If picking this up later: same shape of problem
as Lightspeed, would need a hop through each company's own `nea.com/portfolio/<slug>`
page (912 of them) to discover the external URL, at the standard courtesy delay
-- likely a multi-hour job on its own, lower priority than the description
backfill above since NEA already has full description coverage.
