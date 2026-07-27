alter table public.match_runs
    add column if not exists similarity_threshold numeric not null default 0.3;
