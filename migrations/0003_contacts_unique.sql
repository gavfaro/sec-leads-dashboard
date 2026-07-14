-- Prevent duplicate contacts for the same person at the same firm.
-- The scraper uses get_or_create_contact which checks this manually,
-- but without a DB constraint two concurrent scrape runs can race and both insert.
create unique index if not exists contacts_org_name_unique
    on public.contacts (org_id, first_name, last_name);
