-- Security review ahead of deployment found two policies broader than their
-- own stated justification requires:
--
-- 1. allowed_domains' public SELECT (added in 0012 so a rejected visitor
--    could be told *why*, for one specific page they already know the id
--    of) is `using (true)` — a row-filtering RLS policy can't distinguish
--    "queried with a page_id filter" from "dumped the whole table", so this
--    actually grants instance-wide enumeration of every private page's
--    domain allowlist. Revert to owner-only and add a security-definer RPC
--    scoped to one page, mirroring 0012's own get_page_privacy pattern.
--
-- 2. candidate-photos storage SELECT ignores page privacy entirely — a
--    private election's candidate photos are publicly fetchable. The fix is
--    NOT a direct call to is_domain_allowed() inside the storage policy:
--    that function's EXECUTE was deliberately revoked from anon in 0010
--    (anonymous visitors never reach it — checkPageAccess always requires
--    sign-in first), and Postgres doesn't guarantee OR short-circuits
--    before evaluating every branch, so calling it directly here would risk
--    a permission error for the common case of an anonymous visitor viewing
--    a *public* page's photos. can_view_page_content() wraps the full check
--    as its own security-definer function instead, so its body runs as the
--    function's owner regardless of the caller's role.

drop policy "allowed_domains are publicly readable" on allowed_domains;
create policy "allowed_domains are readable by the page owner only"
  on allowed_domains for select
  using (
    exists (
      select 1 from pages
      where pages.id = allowed_domains.page_id
        and pages.owner_id = auth.uid()
    )
  );

create or replace function get_page_allowed_domains(p_page_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select domain from allowed_domains where page_id = p_page_id;
$$;

create or replace function can_view_page_content(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pages
    where id = p_page_id
      and (
        not is_private
        or owner_id = auth.uid()
        or (auth.jwt() ->> 'email' is not null and is_domain_allowed(id, auth.jwt() ->> 'email'))
      )
  );
$$;

drop policy "candidate photos are publicly readable" on storage.objects;
create policy "candidate photos are readable by anyone who can view the page"
  on storage.objects for select
  using (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and can_view_page_content(pages.id)
    )
  );
