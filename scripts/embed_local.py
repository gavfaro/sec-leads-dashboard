"""
One-time (and periodically re-runnable) maintenance script: embeds every distinct
vertical tag, every company description, and every contact bio using a *local*
sentence-transformers model -- no API calls, no rate limit, since this covers
thousands of rows. Must use the exact same model as lib/matching/embeddings.ts's
live path (sentence-transformers/all-MiniLM-L6-v2), or the sets of vectors won't
be comparable.

Run whenever new companies/tags/contacts get scraped:
    source .venv/bin/activate && python scripts/embed_local.py
"""
import hashlib
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

root_dir = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=root_dir / ".env")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
BATCH_SIZE = 64


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and "
              "SUPABASE_SERVICE_ROLE_KEY in .env.", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


def normalize_tag(tag: str) -> str:
    return tag.strip().lower()


def description_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fetch_all(sb: Client, table: str, columns: str, order_col: str) -> list[dict]:
    """
    Paginate a table to completion instead of relying on a single unpaginated
    select(), which PostgREST silently caps at its default row limit (1000) --
    confirmed happening for company_embeddings once it passed 1000 rows: the
    cache-hash lookup below was only ever seeing the first 1000 of 6000+ rows,
    so ~5000 already-embedded companies looked "not yet cached" and got
    needlessly re-embedded on every single run. order_col must be a unique
    column (a primary key) so page boundaries are stable even with concurrent
    inserts happening elsewhere (e.g. a scraper run) between page requests.
    """
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        page = (
            sb.table(table)
            .select(columns)
            .order(order_col)
            .range(offset, offset + page_size - 1)
            .execute()
            .data
        )
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def embed_missing_tags(sb: Client, model: SentenceTransformer) -> None:
    verticals = fetch_all(sb, "verticals", "id, vertical_name", "id")
    cached = fetch_all(sb, "vertical_tag_embeddings", "tag", "tag")
    cached_set = {row["tag"] for row in cached}

    all_tags = sorted({normalize_tag(v["vertical_name"]) for v in verticals if v["vertical_name"]})
    missing = [t for t in all_tags if t not in cached_set]

    print(f"Verticals: {len(all_tags)} distinct tags, {len(missing)} not yet cached.")
    if not missing:
        return

    embeddings = model.encode(missing, batch_size=BATCH_SIZE, show_progress_bar=True)
    rows = [{"tag": tag, "embedding": emb.tolist()} for tag, emb in zip(missing, embeddings)]
    for i in range(0, len(rows), 500):
        sb.table("vertical_tag_embeddings").upsert(rows[i:i + 500], on_conflict="tag").execute()
    print(f"Cached {len(rows)} new vertical tag embeddings.")


def embed_missing_companies(sb: Client, model: SentenceTransformer) -> None:
    companies = fetch_all(sb, "companies", "id, description", "id")
    cached = fetch_all(sb, "company_embeddings", "company_id, description_hash", "company_id")
    cached_hash_by_id = {row["company_id"]: row["description_hash"] for row in cached}

    to_embed = []
    for c in companies:
        desc = (c.get("description") or "").strip()
        if not desc:
            continue
        h = description_hash(desc)
        if cached_hash_by_id.get(c["id"]) != h:
            to_embed.append((c["id"], desc, h))

    print(f"Companies: {len(companies)} total, {len(to_embed)} need embedding (new or changed description).")
    if not to_embed:
        return

    texts = [t[1] for t in to_embed]
    embeddings = model.encode(texts, batch_size=BATCH_SIZE, show_progress_bar=True)

    rows = [
        {"company_id": company_id, "embedding": emb.tolist(), "description_hash": h}
        for (company_id, _, h), emb in zip(to_embed, embeddings)
    ]
    for i in range(0, len(rows), 500):
        sb.table("company_embeddings").upsert(rows[i:i + 500], on_conflict="company_id").execute()
    print(f"Cached {len(rows)} new/updated company embeddings.")


def embed_missing_bios(sb: Client, model: SentenceTransformer) -> None:
    contacts = fetch_all(sb, "contacts", "id, bio", "id")
    cached = fetch_all(sb, "contact_bio_embeddings", "contact_id, bio_hash", "contact_id")
    cached_hash_by_id = {row["contact_id"]: row["bio_hash"] for row in cached}

    to_embed = []
    for c in contacts:
        bio = (c.get("bio") or "").strip()
        if not bio:
            continue
        h = description_hash(bio)
        if cached_hash_by_id.get(c["id"]) != h:
            to_embed.append((c["id"], bio, h))

    print(f"Contacts: {len(contacts)} total, {len(to_embed)} need embedding (new or changed bio).")
    if not to_embed:
        return

    texts = [t[1] for t in to_embed]
    embeddings = model.encode(texts, batch_size=BATCH_SIZE, show_progress_bar=True)

    rows = [
        {"contact_id": contact_id, "embedding": emb.tolist(), "bio_hash": h}
        for (contact_id, _, h), emb in zip(to_embed, embeddings)
    ]
    for i in range(0, len(rows), 500):
        sb.table("contact_bio_embeddings").upsert(rows[i:i + 500], on_conflict="contact_id").execute()
    print(f"Cached {len(rows)} new/updated contact bio embeddings.")


def main() -> None:
    sb = get_supabase()
    print(f"Loading {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)

    embed_missing_tags(sb, model)
    embed_missing_companies(sb, model)
    embed_missing_bios(sb, model)


if __name__ == "__main__":
    main()
