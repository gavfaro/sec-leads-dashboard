-- Caches embeddings for vertical tag text -- both the fragmented raw tags scraped
-- from each firm's own taxonomy (e.g. Y Combinator alone has 280+ distinct tags:
-- "AIOps", "Generative AI", "Machine Learning", "ML"...) and the sector tags a
-- startup types into the New Match form. Comparing these by embedding cosine
-- similarity instead of exact string match is what lets "AIOps" and "Cybersecurity"
-- register as related without a hand-maintained alias table, which stopped being
-- viable once the tag vocabulary grew into the hundreds.
--
-- Keyed by normalized (trim + lowercase) tag text so re-embedding the same tag
-- string never happens twice, regardless of which table/contact/org it came from.
create table public.vertical_tag_embeddings (
    tag text primary key,
    embedding jsonb not null,
    created_at timestamptz default now()
);
