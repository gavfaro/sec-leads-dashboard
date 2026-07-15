-- Cleans up accidental duplicate `companies` rows created while scraping Accel
-- (same company scraped twice under the exact same name, description, and
-- website -- likely from the ingestion job running more than once). Scoped
-- deliberately narrow: only merges name-groups where every row is (a) linked
-- exclusively to Accel and (b) byte-identical in description/website. Companies
-- backed by more than one firm (e.g. Discord, Dropbox, Scale) legitimately have
-- one row per firm's own scrape with a different description each -- those are
-- left untouched; merging them would silently discard real content.
begin;

create temporary table company_merge_map on commit drop as
with accel_dups as (
    select lower(trim(c.name)) as norm_name
    from companies c
    join portfolio_investments pi on pi.company_id = c.id
    join organizations o on o.id = pi.org_id
    where o.name = 'Accel'
    group by lower(trim(c.name))
    having count(distinct c.id) > 1
),
per_name as (
    select lower(trim(c.name)) as norm_name,
           count(distinct pi.org_id) as distinct_orgs,
           count(distinct coalesce(c.description, '')) as distinct_descriptions,
           count(distinct coalesce(c.website, '')) as distinct_websites
    from companies c
    join portfolio_investments pi on pi.company_id = c.id
    where lower(trim(c.name)) in (select norm_name from accel_dups)
    group by lower(trim(c.name))
),
safe_names as (
    select norm_name from per_name
    where distinct_orgs = 1 and distinct_descriptions = 1 and distinct_websites = 1
),
grouped as (
    select c.id,
           first_value(c.id) over (partition by lower(trim(c.name)) order by c.id::text) as keeper_id
    from companies c
    where lower(trim(c.name)) in (select norm_name from safe_names)
)
select id as loser_id, keeper_id
from grouped
where id <> keeper_id;

-- Reassign every FK pointing at a loser company onto its keeper.
update portfolio_investments pi
set company_id = m.keeper_id
from company_merge_map m
where pi.company_id = m.loser_id;

update contact_investments ci
set company_id = m.keeper_id
from company_merge_map m
where ci.company_id = m.loser_id;

-- The reassignment above can produce duplicate (org_id, company_id) rows in
-- portfolio_investments (loser and keeper were each linked to Accel separately) --
-- keep the most complete row per pair (has investment_stage, then has
-- year_partnered, then lowest id as a final tiebreak) and drop the rest. This also
-- incidentally cleans up the small number of pre-existing duplicate pairs that
-- predate this merge.
with ranked as (
    select id,
           row_number() over (
               partition by org_id, company_id
               order by (investment_stage is not null) desc,
                        (year_partnered is not null) desc,
                        id
           ) as rn
    from portfolio_investments
)
delete from portfolio_investments
where id in (select id from ranked where rn > 1);

-- Same idea for contact_investments (partner + company + relationship should be
-- unique); prefer the row with an exit_note if one has it.
with ranked as (
    select id,
           row_number() over (
               partition by contact_id, company_id, relationship
               order by (exit_note is not null) desc, id
           ) as rn
    from contact_investments
)
delete from contact_investments
where id in (select id from ranked where rn > 1);

-- Now safe to drop the duplicate company rows -- nothing references them anymore.
delete from companies
where id in (select loser_id from company_merge_map);

commit;
