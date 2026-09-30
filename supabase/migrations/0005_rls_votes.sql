-- supabase/migrations/0005_rls_votes.sql

alter table votes enable row level security;
alter table vote_tallies enable row level security;
alter table voter_turnout enable row level security;

create policy "voters can read only their own vote"
  on votes for select
  using (voter_id = auth.uid());

create policy "voters can cast their own vote within the voting window"
  on votes for insert
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and now() between pages.voting_starts_at and pages.voting_ends_at
        and (
          pages.is_private = false
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "voters can change their own vote within the voting window"
  on votes for update
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and now() between pages.voting_starts_at and pages.voting_ends_at
    )
  );

create policy "vote_tallies are readable per parent page visibility"
  on vote_tallies for select
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

create policy "voter_turnout is readable by the page owner only"
  on voter_turnout for select
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));
