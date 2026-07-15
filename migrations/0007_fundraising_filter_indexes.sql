-- Fixes "CANCELING STATEMENT DUE TO STATEMENT TIMEOUT" on the main dashboard
-- when filtering/sorting by date or raise amount.
--
-- company_fundraising_profiles (migration 0004) computes filing_date_parsed
-- and target_raise_numeric with a CASE + regex + cast on every row, rather
-- than storing them. A plain btree index on the underlying text column
-- (FILING_DATE, TOTALOFFERINGAMOUNT) can't satisfy a range filter or ORDER BY
-- on that computed expression, so Postgres was evaluating the expression for
-- every joined row and sorting the full result before applying the page's
-- .range() — expensive enough to blow the statement timeout once date/raise
-- filters were combined with the default date_desc sort.
--
-- Expression indexes here are built with the exact same expression the view
-- uses, so Postgres's query rewriter can match them and push the filter/sort
-- down to an index scan on the base table instead.
--
-- No CONCURRENTLY: the Supabase SQL editor always runs queries inside a
-- transaction, and CONCURRENTLY can't run inside one (only a direct psql
-- session outside the editor can use it). These builds take a brief write
-- lock on the table (blocks the daily cron's inserts, not reads) for the
-- duration of the build.

-- to_date() is STABLE (not IMMUTABLE) in Postgres, so it's rejected inside an
-- index expression even though this fixed 'DD-MON-YYYY' + 3-letter-English-
-- month format never actually varies by session. Wrapping it in our own
-- IMMUTABLE function is the standard workaround. The view is then updated to
-- call this same function so its filing_date_parsed expression is a byte-for-
-- byte match with the index expression below — Postgres only pushes a filter/
-- sort down to an expression index when the parsed expressions are identical.
CREATE OR REPLACE FUNCTION public.parse_form_d_filing_date(filing_date text)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN filing_date ~ '^\d{2}-[A-Za-z]{3}-\d{4}$'
            THEN to_date(filing_date, 'DD-MON-YYYY')
        ELSE NULL
    END
$$;

-- Same 12 original + appended columns as migration 0004, with only
-- filing_date_parsed's definition swapped to call the new function.
CREATE OR REPLACE VIEW public.company_fundraising_profiles AS
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
   OR i."IS_PRIMARYISSUER_FLAG" IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_filing_date_parsed
    ON submissions ((public.parse_form_d_filing_date("FILING_DATE")) DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_offering_target_raise_numeric
    ON offering ((
        CASE
            WHEN "TOTALOFFERINGAMOUNT" ~ '^\d+(\.\d+)?$'
                THEN "TOTALOFFERINGAMOUNT"::numeric
            ELSE NULL
        END
    ) DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_offering_investment_fund_type
    ON offering ("INVESTMENTFUNDTYPE");

CREATE INDEX IF NOT EXISTS idx_offering_total_amount_sold
    ON offering ("TOTALAMOUNTSOLD" DESC NULLS LAST);
