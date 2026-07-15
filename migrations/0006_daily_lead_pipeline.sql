-- Support for the daily SEC Form D scraper (GitHub Actions cron).
--
-- Raw Form D data for scraped filings should be inserted directly into the
-- existing issuers / offering / submissions / related_persons tables using
-- their real ACCESSIONNUMBER-keyed rows — that's what makes every existing
-- filter, saved search, and the match engine pick new leads up automatically
-- through company_fundraising_profiles. Nothing new is needed for that part.
--
-- What's new here is tracking *which* rows came from the daily automated
-- pipeline (so a "Newest Additions" section can be built) and storing the
-- investor/VC-hunt results, which don't fit the bulk SEC schema.

-- Marks a filing as having been discovered + processed by the daily cron,
-- separate from filing_date (the SEC's date) — this is our own ingestion
-- timestamp, used to power "Newest Additions."
create table if not exists public.lead_discoveries (
    id uuid primary key default gen_random_uuid(),
    cik bigint not null,
    accession_number text not null unique,
    discovered_at timestamptz not null default now(),
    source text not null default 'sec_daily_index_cron'
);

create index if not exists lead_discoveries_discovered_at_idx
    on public.lead_discoveries (discovered_at desc);

-- One row per investor/VC found for a filing, from either the open-web
-- "smart search" (PR/news) or the board-seat/outside-director hack.
create table if not exists public.discovered_investors (
    id uuid primary key default gen_random_uuid(),
    cik bigint not null,
    accession_number text not null,
    investor_name text not null,
    investor_type text,
    role text,
    confidence text check (confidence in ('high', 'medium', 'low')),
    source_url text,
    evidence text,
    discovery_method text not null check (discovery_method in ('smart_search', 'board_seat_hack')),
    created_at timestamptz not null default now(),
    unique (accession_number, investor_name, discovery_method)
);

create index if not exists discovered_investors_cik_idx
    on public.discovered_investors (cik);

-- ai_profiles already stores website/summary/CEO/LinkedIn (see app/api/enrich).
-- Add the round-signal fields the investor smart search also produces.
alter table public.ai_profiles
    add column if not exists round_stage text,
    add column if not exists round_amount text,
    add column if not exists round_date text,
    add column if not exists round_summary text;

-- Newest Additions feed: every filing the cron has discovered, joined back
-- out to the same fundraising-profile shape the rest of the app already
-- uses, plus whatever AI enrichment has landed for it.
create or replace view public.newest_lead_profiles as
select
    ld.discovered_at,
    ld.source,
    p.*,
    ap.website_url,
    ap.ai_summary,
    ap.ceo_name,
    ap.ceo_linkedin,
    ap.round_stage,
    ap.round_amount,
    ap.round_date,
    ap.round_summary
from public.lead_discoveries ld
join public.company_fundraising_profiles p
    on p."ACCESSIONNUMBER" = ld.accession_number
left join public.ai_profiles ap
    on ap.cik = p.cik;

-- Read access matches the rest of the dashboard (open to the anon key).
-- Writes are NOT granted here on purpose — the cron must insert using
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely.
alter table public.lead_discoveries enable row level security;

drop policy if exists "select_lead_discoveries" on public.lead_discoveries;
create policy "select_lead_discoveries"
    on public.lead_discoveries for select
    using (true);

alter table public.discovered_investors enable row level security;

drop policy if exists "select_discovered_investors" on public.discovered_investors;
create policy "select_discovered_investors"
    on public.discovered_investors for select
    using (true);
