-- 0013's "candidates are readable by anyone who can view the page" storage
-- policy (gated on can_view_page_content()) was already correct — it just
-- never got evaluated, because the candidate-photos bucket's `public: true`
-- flag makes Supabase's storage-api serve every object with no auth/RLS
-- check at all, on every URL form (confirmed empirically: an unauthenticated
-- curl returned 200 on both the /object/public/ and plain /object/ paths).
-- Flipping the bucket private is what finally activates that policy — no
-- policy SQL needs to change again.
--
-- photo_url is renamed to photo_path because the app no longer stores a
-- permanent URL: signed URLs expire, so what's persisted from here on is
-- the storage object path, with a fresh signed URL generated server-side
-- (using the viewer's own session, so RLS is re-evaluated at sign time) each
-- time a candidate's photo is actually rendered.

alter table candidates rename column photo_url to photo_path;

update storage.buckets set public = false where id = 'candidate-photos';
