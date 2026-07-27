-- Addresses Supabase's "project is exhausting multiple resources" warning.
-- Two concrete problems found by static review (pg_stat_statements wasn't
-- reachable — project was returning Cloudflare 522s at the time):
--
-- 1. Every company profile page view runs
--      SELECT * FROM related_persons WHERE "ACCESSIONNUMBER" = ?
--    with no index on that column at all — a sequential scan on every single
--    page load, on what's likely one of the highest-traffic queries in the
--    app.
--
-- 2. The dashboard's sort columns (filing_date_parsed, target_raise_numeric,
--    amount_sold) each only have a single-column index — no deterministic
--    tiebreaker for rows that share the same sort value. That's not just a
--    missed optimization: under OFFSET pagination (.range()), ties with no
--    stable secondary order can be returned in a different sequence between
--    page 1 and page 2's queries, silently skipping or duplicating rows. It
--    also means keyset/cursor pagination (WHERE (col, issuer_id) < (...))
--    can't be built on top of these columns yet.
--
-- No CONCURRENTLY, matching migrations 0007/0010's convention — the Supabase
-- SQL editor runs each migration inside a transaction, and CONCURRENTLY
-- can't run inside one. These take a brief write lock (blocks the daily
-- cron's inserts/matview refresh, not reads) for the duration of the build.

-- related_persons is queried by ACCESSIONNUMBER on every profile page view.
-- id is included as a tiebreaker so the same index can back a future
-- paginated "all related persons" view without a separate composite.
CREATE INDEX IF NOT EXISTS idx_related_persons_accession
    ON public.related_persons ("ACCESSIONNUMBER", id);

-- issuer_id is the matview's unique/PK-equivalent column (see
-- idx_cfp_issuer_id in migration 0010), so pairing it as a second sort key
-- makes ordering deterministic for every dashboard sort mode and gives each
-- column a composite index that can support keyset pagination later.
--
-- A composite (col, issuer_id) index also fully subsumes a single-column
-- index on col alone for both filtering (gte/lte/eq on col) and sorting by
-- col alone, via the leftmost-prefix rule — so the old single-column
-- versions below are superseded and dropped rather than left as dead weight
-- the matview refresh has to maintain.
CREATE INDEX IF NOT EXISTS idx_cfp_filing_date_issuer_keyset
    ON public.company_fundraising_profiles (filing_date_parsed DESC NULLS LAST, issuer_id DESC);
DROP INDEX IF EXISTS public.idx_cfp_filing_date_parsed;

CREATE INDEX IF NOT EXISTS idx_cfp_raise_issuer_keyset
    ON public.company_fundraising_profiles (target_raise_numeric DESC NULLS LAST, issuer_id DESC);
DROP INDEX IF EXISTS public.idx_cfp_target_raise_numeric;

CREATE INDEX IF NOT EXISTS idx_cfp_sold_issuer_keyset
    ON public.company_fundraising_profiles (amount_sold DESC NULLS LAST, issuer_id DESC);
DROP INDEX IF EXISTS public.idx_cfp_amount_sold;

-- company_name (name_asc sort) had no supporting index at all before this —
-- pure net-new, not a replacement.
CREATE INDEX IF NOT EXISTS idx_cfp_name_issuer_keyset
    ON public.company_fundraising_profiles (company_name ASC, issuer_id ASC);
