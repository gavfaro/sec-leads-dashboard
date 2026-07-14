-- Matching engine now scores individual investors (contacts), not firms -- an org_id
-- is still derivable via contacts.org_id, so contact_id replaces org_id.
delete from public.match_results;

alter table public.match_results
    add column contact_id uuid not null references public.contacts(id) on delete cascade,
    drop column org_id;
