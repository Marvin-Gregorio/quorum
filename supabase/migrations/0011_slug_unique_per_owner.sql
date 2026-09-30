-- supabase/migrations/0011_slug_unique_per_owner.sql

-- Slugs move from globally unique to unique per owner, so two different
-- managers can each have their own "election-2026" and URLs identify a page
-- by (owner_id, slug) instead of slug alone.
alter table pages drop constraint pages_slug_key;
alter table pages add constraint pages_owner_id_slug_key unique (owner_id, slug);
