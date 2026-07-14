-- Matching engine: stores each staff-run match attempt and its ranked investor results.
-- Run this against the live Supabase database (SQL editor or psql) before using
-- math_engine/matcher.py or the /match UI.

create table public.match_runs (
    id uuid default gen_random_uuid() primary key,
    startup_name text not null,
    startup_input jsonb not null,
    created_at timestamptz default now()
);

create table public.match_results (
    id uuid default gen_random_uuid() primary key,
    match_run_id uuid references public.match_runs(id) on delete cascade,
    org_id uuid references public.organizations(id) on delete cascade,
    score numeric not null,
    score_breakdown jsonb not null,
    rank integer not null
);

create index match_results_match_run_id_idx on public.match_results(match_run_id);
