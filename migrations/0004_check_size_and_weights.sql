-- Per-contact check size, for when it's manually researched (e.g. via Crunchbase)
-- rather than scraped -- most firms don't publish this, so it's nullable and only
-- overrides the fallback chain when actually filled in.
alter table public.contacts
    add column typical_check_size numeric;

-- Records which score weights produced a given run, since they're now tunable
-- per-run rather than a fixed constant -- needed to make sense of old runs after
-- the defaults change.
alter table public.match_runs
    add column weights_used jsonb;
