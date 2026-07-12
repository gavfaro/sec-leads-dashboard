# FundFinder scraping context — handoff

Ellerra's VC CRM. Supabase (Postgres via PostgREST) backend. Goal: scrape VC firm
portfolio pages and team/partner pages, insert into the schema below. This doc is the
context a fresh Claude session needs to keep writing scrapers that insert correctly.

## Credentials

`.env` needs:
```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...   # anon key — read-only in practice
SUPABASE_SERVICE_ROLE_KEY=...  # required for writes
```
`organizations` and `contacts` have Row Level Security enabled with no policies, so the
anon/publishable key **cannot write** to them. Always create the Supabase client with
`SUPABASE_SERVICE_ROLE_KEY`, never the publishable key, for any insert/update script.

Python deps used so far: `supabase`, `playwright` (+ `playwright install chromium`),
`beautifulsoup4`, `pdfplumber`, `python-dotenv`.

## Schema (live, as of last check)

Insert in this order to satisfy foreign keys:

1. **`entity_types`** — lookup table, already seeded. Columns: `id`, `type_name` (unique).
   Current values: `Multi-Stage VC`, `Early-Stage VC`, `Late-Stage Crossover`,
   `Thematic VC`, `Syndicate / SPV`, `Public REIT`, `Private Non-Listed REIT`,
   `Private Placement / CRE`, `Pension Fund / Allocator`. Look up by `type_name`, don't
   create new ones without asking — this taxonomy is for VC firms generally so most new
   firms should map to `Multi-Stage VC` or `Early-Stage VC`.

2. **`organizations`** — the VC firm itself. Columns: `id`, `name` (not null),
   `entity_type_id` (FK), `aum` (numeric), `website`. **Check for an existing row by name
   before inserting** — `name` has no unique constraint, so nothing stops a duplicate. A
   firm can appear under a slightly different string across sources (e.g. "Greylock" vs
   "Greylock Partners") — if unsure, query `select id, name from organizations` and
   eyeball it before creating a new one; merging a duplicate after the fact means
   reassigning every child row's `org_id` and deleting the extra row.

3. **`companies`** — portfolio companies, one row per company across *all* firms (a
   startup backed by two firms is one row referenced twice). Columns: `id`, `name`
   (unique, not null), `website`, `description`. Use `.upsert(..., on_conflict="name")`,
   **but do a case-insensitive lookup first** (`.ilike("name", name)`) — the same company
   shows up with different casing across sources (portfolio page "Appdynamics" vs a bio
   PDF's "AppDynamics") and the unique constraint is case-sensitive, so upsert alone
   creates duplicates.

4. **`contacts`** — individual partners/investors. Columns: `id`, `org_id` (FK),
   `first_name`, `last_name` (both not null), `role`, `linkedin_url`, `other_sites`
   (jsonb — use for secondary links like Twitter/X; don't invent new keys casually,
   `{"twitter": "..."}` is the convention so far), `accreditation_verified`, `bio`,
   `email`. Get-or-create by `(org_id, first_name, last_name)` — **normalize whitespace
   first** (`re.sub(r"\s+", " ", full_name).strip()`) before splitting on the first
   space, or double-spaced names from sloppy source HTML create duplicate contacts.
   For `role`: use the actual title text the site publishes when it publishes one: don't
   hardcode a title like "Partner" for everyone — many sites only label some team members
   and leave others blank. Fall back to a source-grounded default (e.g. the name of the
   page section they're listed under, like "Investor") rather than fabricating a title.

5. **`portfolio_investments`** — firm-level junction: `id`, `org_id` (FK), `company_id`
   (FK), `investment_stage` (text, e.g. "Seed", "Series A" — whatever the source site
   calls it). Get-or-create on `(org_id, company_id)` before inserting, so re-running a
   scraper is idempotent.

6. **`contact_investments`** — partner-level junction (added for Greylock's per-partner
   bio PDFs, which list each partner's individual deals): `id`, `contact_id` (FK),
   `company_id` (FK), `relationship` (`'current'` or `'previous'`, not null), `exit_note`
   (text, e.g. "Acquired by Cisco in 2017", null for current). Get-or-create on
   `(contact_id, company_id, relationship)`. Only populate this if the source actually
   distinguishes a partner's personal deal history — don't fabricate it from firm-level
   portfolio data.

7. **`verticals`** — sector/tag lookup: `id`, `vertical_name` (unique, not null).
   Get-or-create by name. Existing values: AI, Ad Tech, Commercial Real Estate (CRE),
   Consumer, Consumer Products, Cybersecurity, Fintech & Crypto, Infrastructure,
   Marketplace & Commerce, SaaS, Sport Tech. **Reuse existing rows** (case-sensitive
   exact match) rather than creating near-duplicates like "Fintech" vs "Fintech & Crypto".

8. **`vertical_focus`** — firm-level junction: `id`, `org_id` (FK), `vertical_id` (FK),
   `preferred_stage`, `typical_check_size` (numeric). Get-or-create on
   `(org_id, vertical_id)`. Populated from whatever sector/domain taxonomy the source
   site itself publishes per company (e.g. Greylock tags each portfolio company with a
   "DOMAIN" like "AI, Cybersecurity") — split on comma, one `verticals` row + one
   `vertical_focus` row per tag. Don't invent tags via keyword-matching on descriptions
   unless the user explicitly asks for that (they've declined it once already — they
   want raw structured data captured, and filter/tag manually afterward).

9. **`contact_verticals`** — partner-level sector junction: `id`, `contact_id` (FK),
   `vertical_id` (FK). Exists but is **currently unused** — `vertical_focus` (firm-level)
   turned out to be the better fit for what's been scraped so far. Only use this if a
   source ties a specific partner (not the whole firm) to a sector.

Not scraper-relevant but present in the DB: `clients`, `client_verticals`,
`pipeline_stages`, `deals` — Ellerra's own deal-pipeline/CRM tables, unrelated to VC firm
data ingestion.

## Current data state (check before assuming a firm is un-scraped)

Only **Greylock** has been scraped so far: 1 organization, 201 companies, 25 contacts
(12 with full bios from PDFs), 158 portfolio_investments, 110 contact_investments,
11 verticals, 7 vertical_focus rows. Query the tables directly to get current counts —
this snapshot will go stale fast.

To introspect the live schema yourself instead of trusting this doc if it's old, hit the
PostgREST OpenAPI endpoint (works with just `SUPABASE_URL` + any API key as both `apikey`
and `Authorization: Bearer` headers):
```
GET {SUPABASE_URL}/rest/v1/
```
The `definitions` key has every table's columns, types, and FK notes.

## Target firm list

`Firms.csv` in the repo root has ~50 VC firms queued up (Sequoia, a16z, Accel, Index,
Lightspeed, Founders Fund, Kleiner Perkins, NEA, etc.), most already researched with
columns: `website`, `portfolio site` URL, `Teams` URL(s), `notes` (e.g. "Load more
button", "infinite scroll" — how the portfolio page paginates), `Insights` (freeform,
e.g. "many companies have their own teams pages, maybe grab that too"). Work through it
firm by firm — each needs its own parser since every VC site's DOM is different.

## Scraping approach that's worked (Greylock)

- **Fetch**: Playwright chromium, realistic desktop Chrome `User-Agent` (some sites
  403 a bare/headless request without one), `wait_until="networkidle"` plus a few
  seconds' extra `wait_for_timeout` for client-rendered content to finish painting.
- **Check `robots.txt` first** and respect `Crawl-delay` (`time.sleep()` between
  requests to the same host).
- **Parse** the rendered HTML with BeautifulSoup — don't try to do complex extraction
  with Playwright locators; grab `page.content()` once and parse statically.
- **Investigate the real DOM before writing selectors** — save a rendered page to a
  scratch file and grep/inspect it rather than guessing class names. VC portfolio pages
  reliably have a repeating "company card" container with logo/name, description,
  investment stage, current status (keep stage and status as separate fields — sites
  often do, and conflating "Series B" with "Acquired" loses real information), sector
  tags, and the partner name(s) who led the deal.
- **Team/bio pages**: if a firm publishes downloadable partner bio PDFs (Greylock does),
  they can contain far richer data than the web page — full bio text and a personal
  current/previous investment list. Use `pdfplumber` with `extract_text(x_tolerance=1)`
  (the default tolerance glues words together on some PDFs with tight kerning). Scan the
  whole document's text rather than assuming a fixed page count/layout — bio length and
  whether investments are split into "CURRENT"/"PREVIOUS" sections vs one combined
  "INVESTMENTS" list (classify each entry as previous if its parenthetical note contains
  "acqui" or "ipo", current otherwise) varies per partner even within the same firm.
- **Registry pattern**: `scraper.py` (this repo) keeps a `FIRM_REGISTRY` dict keyed by
  firm slug, each entry holding its portfolio URL, entity type, and a firm-specific
  parser function; a separate `TEAM_SCRAPERS` dict does the same for team-page scraping.
  Reuse this pattern for new firms rather than one-off scripts, and reuse the
  `get_or_create_*` / `upsert_company` helper functions already in that file instead of
  reimplementing insert logic per firm.
