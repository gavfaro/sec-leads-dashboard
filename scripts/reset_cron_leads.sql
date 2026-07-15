-- Deletes ONLY filings that the daily cron pipeline discovered — i.e. rows
-- with a matching entry in lead_discoveries. Historical/bulk-loaded filings
-- (no lead_discoveries row) are never touched. Safe to re-run repeatedly
-- while testing the cron.

begin;

delete from public.discovered_investors
where accession_number in (select accession_number from public.lead_discoveries);

delete from public.related_persons
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries);

delete from public.offering
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries);

delete from public.submissions
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries);

delete from public.issuers
where "ACCESSIONNUMBER" in (select accession_number from public.lead_discoveries);

-- ai_profiles is keyed by cik, not accession_number — if a cik has BOTH a
-- historical filing and a cron-discovered one, this also clears its AI
-- profile. Fine for testing; skip this delete if that matters to you.
delete from public.ai_profiles
where cik in (select cik from public.lead_discoveries);

delete from public.lead_discoveries;

commit;
