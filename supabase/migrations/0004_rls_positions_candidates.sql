-- supabase/migrations/0004_rls_positions_candidates.sql

alter table positions enable row level security;
alter table candidates enable row level security;

create policy "positions are readable per parent page visibility"
  on positions for select
  using (
    exists (
      select 1 from pages
      where pages.id = page_id
        and (
          pages.is_private = false
          or pages.owner_id = auth.uid()
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "positions are insertable by owner before voting starts"
  on positions for insert
  with check (
    exists (
      select 1 from pages
      where pages.id = page_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "positions are updatable by owner any time"
  on positions for update
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()))
  with check (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "positions are deletable by owner before voting starts"
  on positions for delete
  using (
    exists (
      select 1 from pages
      where pages.id = page_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "candidates are readable per parent page visibility"
  on candidates for select
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and (
          pages.is_private = false
          or pages.owner_id = auth.uid()
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "candidates are insertable by owner before voting starts"
  on candidates for insert
  with check (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "candidates are updatable by owner any time"
  on candidates for update
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id and pages.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id and pages.owner_id = auth.uid()
    )
  );

create policy "candidates are deletable by owner before voting starts"
  on candidates for delete
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );
