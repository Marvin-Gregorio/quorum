-- supabase/migrations/0012_private_page_access_context.sql
--
-- Bug: the "pages" SELECT RLS policy (is_private = false OR owner_id =
-- auth.uid() OR is_domain_allowed(...)) hides a private page's row entirely
-- from an unauthenticated or wrong-domain visitor. Vote/Results pages used a
-- plain RLS-gated select for their initial existence check, so that check
-- came back null indistinguishably from "doesn't exist" -- sending everyone
-- straight to '/' instead of ever reaching the sign-in / access-restricted
-- redirect. These two functions answer only "does a page exist here, and is
-- it private" (and, separately, "is this specific page private") without
-- relying on the caller already having read access to the row, so the app
-- can correctly branch on sign-in-required vs restricted vs doesn't-exist.

create function find_page_by_owner_slug(p_owner_id uuid, p_slug text)
returns table(page_id uuid, is_private boolean)
language sql
stable
security definer
set search_path = public
as $$
  select id, is_private from pages where owner_id = p_owner_id and slug = p_slug;
$$;

create function get_page_privacy(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_private from pages where id = p_page_id;
$$;

-- Domain names aren't sensitive (the organization name is already shown
-- publicly everywhere); the access-restricted page needs to read them to
-- explain *why* a visitor was rejected, not just the page's owner.
drop policy "allowed_domains are readable by the page owner only" on allowed_domains;
create policy "allowed_domains are publicly readable"
  on allowed_domains for select
  using (true);
