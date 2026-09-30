-- supabase/migrations/0010_domain_matching_and_storage.sql
--
-- I8: domain matching in is_domain_allowed() was case-sensitive, and domains
-- weren't normalized when stored, so "Example.com" as an allowed domain
-- would never match a voter signing in with "user@example.com". Compare
-- lower(...) on both sides; storage normalization (lowercase + trim on
-- insert) is handled in application code (createElectionAction /
-- updateElectionSettingsAction).
--
-- Also (minor finding): is_domain_allowed() was callable via RPC by the
-- anon role, letting anyone probe a private page's allowed domains without
-- being a member. Revoke anon execute; it stays available to authenticated,
-- which is the only role that calls it (checkPageAccess always requires a
-- signed-in user first).
--
-- Also (minor finding): the candidate-photos storage bucket had no
-- file_size_limit or allowed_mime_types, so any file type/size could be
-- uploaded to it.

create or replace function is_domain_allowed(p_page_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_domains
    where page_id = p_page_id
      and lower(domain) = lower(split_part(p_email, '@', 2))
  );
$$;

revoke execute on function is_domain_allowed(uuid, text) from anon;

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'candidate-photos';
