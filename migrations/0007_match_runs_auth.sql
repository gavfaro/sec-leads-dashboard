-- Scope saved matches to the signed-in user, same pattern as 0005_saved_searches_auth.
-- user_id already exists live (added directly against Supabase before this repo's
-- merge conflict) -- `if not exists` here so this is safe to re-run.
alter table public.match_runs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.match_runs enable row level security;

drop policy if exists "select_own_match_runs" on public.match_runs;
create policy "select_own_match_runs"
  on public.match_runs for select
  using (user_id = auth.uid());

drop policy if exists "delete_own_match_runs" on public.match_runs;
create policy "delete_own_match_runs"
  on public.match_runs for delete
  using (user_id = auth.uid());

-- match_results has no user_id of its own; ownership flows through its parent run.
alter table public.match_results enable row level security;

drop policy if exists "select_own_match_results" on public.match_results;
create policy "select_own_match_results"
  on public.match_results for select
  using (
    exists (
      select 1 from public.match_runs
      where match_runs.id = match_results.match_run_id
        and match_runs.user_id = auth.uid()
    )
  );
