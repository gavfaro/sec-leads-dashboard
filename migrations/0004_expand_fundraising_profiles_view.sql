-- Expands company_fundraising_profiles with real Form D fields for filtering,
-- and fixes two correctness bugs in the existing view:
--   1. filing_date is stored as text "DD-MON-YYYY" (e.g. 31-OCT-2025), so
--      `order by filing_date desc` sorts alphabetically, not chronologically.
--      filing_date_parsed (date) fixes this.
--   2. target_raise is text and holds "Indefinite" for some filings, so
--      numeric comparisons on it are lexicographic, not numeric.
--      target_raise_numeric (numeric, null when indefinite/unparseable) fixes this.
--
-- Purely additive: every column the app currently selects keeps its name,
-- type, and meaning. Safe to apply without touching app/page.tsx or
-- app/company/[accessionNumber]/page.tsx first.

-- Postgres only allows CREATE OR REPLACE VIEW to append new columns at the
-- end of the SELECT list — inserting one in the middle shifts every column
-- after it and looks like a rename, which Postgres rejects. So the original
-- 12 columns below are left in their exact original order/position, and
-- every new column is appended after them.
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

    -- New columns (appended only — see note above)
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

    CASE
        WHEN s."FILING_DATE" ~ '^\d{2}-[A-Za-z]{3}-\d{4}$'
            THEN to_date(s."FILING_DATE", 'DD-MON-YYYY')
        ELSE NULL
    END AS filing_date_parsed
FROM issuers i
LEFT JOIN offering o ON i."ACCESSIONNUMBER" = o."ACCESSIONNUMBER"
LEFT JOIN submissions s ON i."ACCESSIONNUMBER" = s."ACCESSIONNUMBER"
WHERE (i."IS_PRIMARYISSUER_FLAG" = ANY (ARRAY['true'::text, 'y'::text, '1'::text, 'yes'::text]))
   OR i."IS_PRIMARYISSUER_FLAG" IS NULL;
