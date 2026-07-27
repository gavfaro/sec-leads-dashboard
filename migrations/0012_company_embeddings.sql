-- Caches a semantic embedding of each company's description, generated locally
-- (scripts/embed_local.py, sentence-transformers/all-MiniLM-L6-v2 running on-device
-- -- no API calls, no rate limit, since this runs over every company in the
-- database). Used two ways:
--   1. "Similar companies" search: embed a startup's description live, compare
--      against every cached company vector, surface the closest matches and who
--      invested in them.
--   2. The matching engine's text score: for each contact, sum the similarities
--      of their portfolio companies against the startup (above a relevance
--      threshold), rewarding investors who've backed *many* relevant companies,
--      not just one.
--
-- description_hash lets the backfill script detect when a company's description
-- has changed (e.g. re-scraped/enriched) and needs re-embedding, without having to
-- re-embed everything every run.
create table public.company_embeddings (
    company_id uuid primary key references public.companies(id) on delete cascade,
    embedding jsonb not null,
    description_hash text not null,
    created_at timestamptz default now()
);
