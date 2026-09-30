-- supabase/migrations/0002_vote_tables.sql

create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references profiles(id),
  position_id uuid not null references positions(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (voter_id, position_id)
);

create table vote_tallies (
  position_id uuid not null references positions(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  vote_count int not null default 0,
  primary key (position_id, candidate_id)
);

create table voter_turnout (
  page_id uuid not null references pages(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  voter_id uuid not null references profiles(id),
  voted_at timestamptz not null default now(),
  primary key (position_id, voter_id)
);

create function maintain_vote_rollups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_id uuid;
begin
  select page_id into v_page_id from positions where id = new.position_id;

  if tg_op = 'UPDATE' and old.candidate_id is distinct from new.candidate_id then
    update vote_tallies
      set vote_count = vote_count - 1
      where position_id = old.position_id and candidate_id = old.candidate_id;
  end if;

  insert into vote_tallies (position_id, candidate_id, vote_count)
  values (new.position_id, new.candidate_id, 1)
  on conflict (position_id, candidate_id)
    do update set vote_count = vote_tallies.vote_count + 1
    where tg_op = 'INSERT' or old.candidate_id is distinct from new.candidate_id;

  insert into voter_turnout (page_id, position_id, voter_id, voted_at)
  values (v_page_id, new.position_id, new.voter_id, now())
  on conflict (position_id, voter_id) do update set voted_at = now();

  return new;
end;
$$;

create trigger on_vote_cast
  after insert or update on votes
  for each row execute procedure maintain_vote_rollups();
