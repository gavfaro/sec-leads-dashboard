-- DRY RUN for reset_cron_leads.sql. Read-only — run this first and eyeball
-- the counts/rows before ever running the real delete.

-- 1. What's in lead_discoveries at all?
select count(*) as total_discoveries,
       min(discovered_at) as earliest,
       max(discovered_at) as latest
from public.lead_discoveries;

-- 1b. Every company that would be affected, by name — the main "does this
-- look right" check. One row per company (grouped by CIK); if a company
-- has multiple discovered filings, they're rolled into accession_numbers
-- instead of printing one row per filing.
select i."ENTITYNAME" as company_name,
       ld.cik,
       count(*) as filings_found,
       max(ld.discovered_at) as most_recent_discovery,
       array_agg(ld.accession_number order by ld.discovered_at desc) as accession_numbers
from public.lead_discoveries ld
left join public.issuers i
    on i."ACCESSIONNUMBER" = ld.accession_number
group by i."ENTITYNAME", ld.cik
order by most_recent_discovery desc;

-- 2. Per-table row counts the delete would remove.
select 'discovered_investors' as table_name, count(*) as rows_to_delete
from public.discovered_investors
where accession_number in (select accession_number from public.lead_discoveries)
union all
select 'related_persons', count(*)
from public.related_persons
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries)
union all
select 'offering', count(*)
from public.offering
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries)
union all
select 'submissions', count(*)
from public.submissions
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries)
union all
select 'issuers', count(*)
from public.issuers
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries)
union all
select 'ai_profiles', count(*)
from public.ai_profiles
where cik in (select cik from public.lead_discoveries);

-- 3. The specific risky case flagged earlier: ai_profiles rows the delete
-- would remove that belong to a CIK which ALSO has a filing that did NOT
-- come from the cron (i.e. you'd be deleting enrichment tied to a
-- pre-existing, non-test filing too). Empty result = safe to delete
-- ai_profiles for these ciks; any rows here = review before deleting.
select ap.cik,
       ap.website_url,
       ap.ceo_name,
       i."ACCESSIONNUMBER" as other_filing_accession_number,
       i."ENTITYNAME" as company_name
from public.ai_profiles ap
join public.issuers i
    on i."CIK" = ap.cik
where ap.cik in (select cik from public.lead_discoveries)
  and i."ACCESSIONNUMBER" not in (select accession_number from public.lead_discoveries);

-- 4. Sample rows (10 each) so you can visually confirm these are actually
-- your test filings and not something unexpected.
select "ACCESSIONNUMBER", "ENTITYNAME", "CIK"
from public.issuers
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries)
limit 10;

select i."ENTITYNAME" as company_name,
       di.accession_number,
       count(*) as investors_found,
       array_agg(di.investor_name || ' [' || di.discovery_method || ']' order by di.investor_name) as investors
from public.discovered_investors di
left join public.issuers i
    on i."ACCESSIONNUMBER" = di.accession_number
where di.accession_number in (select accession_number from public.lead_discoveries)
group by i."ENTITYNAME", di.accession_number
limit 10;
