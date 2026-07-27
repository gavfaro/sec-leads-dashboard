create table public.contact_bio_embeddings (
    contact_id uuid primary key references public.contacts(id) on delete cascade,
    embedding jsonb not null,
    bio_hash text not null,
    created_at timestamptz default now()
);
