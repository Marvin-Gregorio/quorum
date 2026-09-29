-- supabase/migrations/0003_rls_pages.sql

create function is_domain_allowed(p_page_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_domains
    where page_id = p_page_id
      and domain = split_part(p_email, '@', 2)
  );
$$;

alter table profiles enable row level security;
alter table pages enable row level security;
alter table allowed_domains enable row level security;

create policy "profiles are readable by their own owner"
  on profiles for select
  using (id = auth.uid());

create policy "profiles are insertable by the mirror trigger only"
  on profiles for insert
  with check (id = auth.uid());

create policy "pages are readable per visibility rule"
  on pages for select
  using (
    is_private = false
    or owner_id = auth.uid()
    or is_domain_allowed(id, auth.jwt() ->> 'email')
  );

create policy "any authenticated user can create a page"
  on pages for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "pages are editable by their owner only"
  on pages for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "pages are deletable by their owner only"
  on pages for delete
  using (owner_id = auth.uid());

create policy "allowed_domains are readable by the page owner only"
  on allowed_domains for select
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "allowed_domains are writable by the page owner only"
  on allowed_domains for insert
  with check (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "allowed_domains are deletable by the page owner only"
  on allowed_domains for delete
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));
