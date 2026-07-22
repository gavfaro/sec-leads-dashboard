-- contacts, organizations, and vertical_focus have RLS enabled with zero policies
-- (per claude_investor.md: this was intentional to block writes through the anon
-- key, forcing scrapers to use the service-role key). But a zero-policy table is
-- unreadable too, not just unwritable -- any query going through a session-aware
-- client (not service-role) silently gets nulls for these tables, which is exactly
-- what happened to match_results' embedded contacts/organizations join once
-- find-investors started reading match_runs/match_results through the session
-- client for per-account scoping.
--
-- This data is shared across every account (the investor database), not
-- per-user, so the fix is a blanket read policy for any signed-in user --
-- INSERT/UPDATE/DELETE remain unrestricted-by-policy (i.e. still blocked for
-- anon/authenticated, service-role only), unchanged from before.
create policy "authenticated_read_contacts"
  on public.contacts for select
  to authenticated
  using (true);

create policy "authenticated_read_organizations"
  on public.organizations for select
  to authenticated
  using (true);

create policy "authenticated_read_vertical_focus"
  on public.vertical_focus for select
  to authenticated
  using (true);
