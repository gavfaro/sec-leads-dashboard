-- Fixes the "sometimes works, sometimes times out" behavior on the main
-- dashboard filters.
--
-- company_fundraising_profiles has been a plain VIEW: every request re-runs
-- a 3-way LEFT JOIN across issuers/offering/submissions (~180K rows) and
-- recomputes target_raise_numeric / filing_date_parsed / is_indefinite_offering
-- from scratch. Migrations 0004/0007 added expression indexes for two of
-- those columns, but most of the filters app/page.tsx actually offers
-- (city, state, industry, entity_type, submission_type, min_investment,
-- revenue_range, federal_exemptions, has_non_accredited_investors,
-- issuer_phone, cik) have never had an index at all — confirmed via
-- pg_indexes: only ACCESSIONNUMBER, ENTITYNAME (trgm), IS_PRIMARYISSUER_FLAG
-- (issuers), ACCESSIONNUMBER/INVESTMENTFUNDTYPE/target_raise_numeric/
-- TOTALAMOUNTSOLD (offering), and ACCESSIONNUMBER/filing_date_parsed
-- (submissions) exist. Whether a given filter combo times out depends
-- entirely on which of those columns it touches.
--
-- Confirmed via the base tables before writing this: offering and
-- submissions are strictly 1:1 with ACCESSIONNUMBER (zero dupes on either),
-- so the join never fans out — one output row per issuer, safe to key on
-- issuer_id. RLS is off on all three base tables (public SEC data), so a
-- materialized view carries no access-control regression.
--
-- This data only changes via a manually-run daily pipeline ("barely run
-- that new stuff anyway" per the app owner), so paying the join/regex cost
-- on every read instead of once per refresh was pure waste. Converting to
-- MATERIALIZED VIEW makes every filter column a real physical column, so
-- normal btree/GIN indexes apply directly — no fragile expression-matching
-- required for the planner to use them.
--
-- Run this whole file in the Supabase SQL editor in one go (same as 0007 —
-- the editor always runs inside a transaction, so no CONCURRENTLY here;
-- this is a one-time migration, a brief exclusive lock during creation is
-- fine). After this, refresh with:
--   REFRESH MATERIALIZED VIEW public.company_fundraising_profiles;
-- whenever the daily pipeline has actually been run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- newest_lead_profiles depends on company_fundraising_profiles (p.*), so it
-- has to be dropped before the view underneath it can be replaced with a
-- materialized view, then recreated unchanged afterward.
DROP VIEW IF EXISTS public.newest_lead_profiles;
DROP VIEW IF EXISTS public.company_fundraising_profiles;

CREATE MATERIALIZED VIEW public.company_fundraising_profiles AS
SELECT
    i.id AS issuer_id,
    i."ACCESSIONNUMBER",
    i."ENTITYNAME" AS company_name,
    i."CIK" AS cik,
    o."INDUSTRYGROUPTYPE" AS industry,
    i."CITY" AS city,
    i."STATEORCOUNTRY" AS state,
    o."TOTALOFFERINGAMOUNT" AS target_raise,
    o."TOTALAMOUNTSOLD" AS amount_sold,
    o."MINIMUMINVESTMENTACCEPTED" AS min_investment,
    s."FILING_DATE" AS filing_date,
    s."SUBMISSIONTYPE" AS submission_type,

    i."STATEORCOUNTRYDESCRIPTION" AS state_description,
    i."ZIPCODE" AS zip_code,
    i."ISSUERPHONENUMBER" AS issuer_phone,
    i."ENTITYTYPE" AS entity_type,
    i."JURISDICTIONOFINC" AS jurisdiction_of_inc,

    CASE
        WHEN o."TOTALOFFERINGAMOUNT" ~ '^\d+(\.\d+)?$'
            THEN o."TOTALOFFERINGAMOUNT"::numeric
        ELSE NULL
    END AS target_raise_numeric,
    (o."TOTALOFFERINGAMOUNT" = 'Indefinite') AS is_indefinite_offering,

    o."INVESTMENTFUNDTYPE" AS investment_fund_type,
    o."REVENUERANGE" AS revenue_range,
    o."AGGREGATENETASSETVALUERANGE" AS aggregate_net_asset_value_range,
    o."FEDERALEXEMPTIONS_ITEMS_LIST" AS federal_exemptions,
    o."HASNONACCREDITEDINVESTORS" AS has_non_accredited_investors,
    o."TOTALNUMBERALREADYINVESTED" AS total_number_already_invested,
    o."ISAMENDMENT" AS is_amendment,

    public.parse_form_d_filing_date(s."FILING_DATE") AS filing_date_parsed
FROM issuers i
LEFT JOIN offering o ON i."ACCESSIONNUMBER" = o."ACCESSIONNUMBER"
LEFT JOIN submissions s ON i."ACCESSIONNUMBER" = s."ACCESSIONNUMBER"
WHERE (i."IS_PRIMARYISSUER_FLAG" = ANY (ARRAY['true'::text, 'y'::text, '1'::text, 'yes'::text]))
   OR i."IS_PRIMARYISSUER_FLAG" IS NULL
WITH DATA;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY later, and doubles as
-- the row-lookup index for anything that joins back to this by issuer_id.
CREATE UNIQUE INDEX idx_cfp_issuer_id
    ON public.company_fundraising_profiles (issuer_id);

-- Exact-match / range filters — every one of these is a real column now,
-- so plain btree works and doesn't depend on expression-matching.
CREATE INDEX idx_cfp_accession ON public.company_fundraising_profiles ("ACCESSIONNUMBER");
CREATE INDEX idx_cfp_cik ON public.company_fundraising_profiles (cik);
CREATE INDEX idx_cfp_industry ON public.company_fundraising_profiles (industry);
CREATE INDEX idx_cfp_entity_type ON public.company_fundraising_profiles (entity_type);
CREATE INDEX idx_cfp_submission_type ON public.company_fundraising_profiles (submission_type);
CREATE INDEX idx_cfp_investment_fund_type ON public.company_fundraising_profiles (investment_fund_type);
CREATE INDEX idx_cfp_revenue_range ON public.company_fundraising_profiles (revenue_range);
CREATE INDEX idx_cfp_has_non_accredited ON public.company_fundraising_profiles (has_non_accredited_investors);
CREATE INDEX idx_cfp_is_indefinite_offering ON public.company_fundraising_profiles (is_indefinite_offering);

CREATE INDEX idx_cfp_target_raise_numeric ON public.company_fundraising_profiles (target_raise_numeric DESC NULLS LAST);
CREATE INDEX idx_cfp_amount_sold ON public.company_fundraising_profiles (amount_sold DESC NULLS LAST);
CREATE INDEX idx_cfp_min_investment ON public.company_fundraising_profiles (min_investment);
CREATE INDEX idx_cfp_filing_date_parsed ON public.company_fundraising_profiles (filing_date_parsed DESC NULLS LAST);

-- phoneOnly filter is `.not("issuer_phone", "is", null)` — a partial index
-- on exactly that predicate lets Postgres satisfy it as an index check
-- instead of a full scan when combined with other filters.
CREATE INDEX idx_cfp_issuer_phone_present ON public.company_fundraising_profiles (issuer_phone)
    WHERE issuer_phone IS NOT NULL;

-- ilike '%text%' (leading wildcard) can never use a plain btree index —
-- trigram GIN indexes are the only way Postgres can use an index for these
-- at all, and they work transparently with the app's existing .ilike() calls.
CREATE INDEX idx_cfp_company_name_trgm ON public.company_fundraising_profiles USING gin (company_name gin_trgm_ops);
CREATE INDEX idx_cfp_city_trgm ON public.company_fundraising_profiles USING gin (city gin_trgm_ops);
CREATE INDEX idx_cfp_state_trgm ON public.company_fundraising_profiles USING gin (state gin_trgm_ops);
CREATE INDEX idx_cfp_federal_exemptions_trgm ON public.company_fundraising_profiles USING gin (federal_exemptions gin_trgm_ops);

-- Same read access the plain view had (confirmed via
-- information_schema.role_table_grants before writing this). Materialized
-- views can't be INSERT/UPDATE/DELETE'd directly regardless of grants, so
-- unlike the old view's grants, only SELECT is meaningful here.
GRANT SELECT ON public.company_fundraising_profiles TO anon, authenticated, service_role;

-- Recreate unchanged from migration 0006.
CREATE OR REPLACE VIEW public.newest_lead_profiles AS
SELECT
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
FROM public.lead_discoveries ld
JOIN public.company_fundraising_profiles p
    ON p."ACCESSIONNUMBER" = ld.accession_number
LEFT JOIN public.ai_profiles ap
    ON ap.cik = p.cik;

GRANT SELECT ON public.newest_lead_profiles TO anon, authenticated, service_role;

-- New relations have no planner statistics until autovacuum gets to them —
-- ANALYZE now so the very first queries after this migration get good plans
-- instead of whatever the planner guesses blind.
ANALYZE public.company_fundraising_profiles;
