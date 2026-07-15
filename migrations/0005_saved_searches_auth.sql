-- Scope saved searches to the signed-in user.
alter table public.saved_searches
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.saved_searches enable row level security;

drop policy if exists "select_own_saved_searches" on public.saved_searches;
create policy "select_own_saved_searches"
  on public.saved_searches for select
  using (user_id = auth.uid());

drop policy if exists "insert_own_saved_searches" on public.saved_searches;
create policy "insert_own_saved_searches"
  on public.saved_searches for insert
  with check (user_id = auth.uid());

drop policy if exists "delete_own_saved_searches" on public.saved_searches;
create policy "delete_own_saved_searches"
  on public.saved_searches for delete
  using (user_id = auth.uid());
