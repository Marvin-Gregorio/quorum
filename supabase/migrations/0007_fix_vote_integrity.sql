-- supabase/migrations/0007_fix_vote_integrity.sql
--
-- C1: ballot-stuffing via position_id swap.
--
-- The votes table's RLS never verified that candidate_id actually belongs to
-- position_id, and the UPDATE policy let a voter change their own row's
-- position_id. That let a single voter repeat-vote for the same candidate by
-- moving their vote row to a throwaway position (freeing up the
-- (voter_id, position_id) unique slot) and back.
--
-- Fix: structurally tie a vote row's candidate to its position via a
-- composite foreign key, and forbid changing position_id/voter_id on an
-- existing vote row via a trigger (RLS policies can't express "this column
-- may not change" cleanly, and PostgREST upsert's DO UPDATE SET touches
-- every column regardless of what the caller intended to change).

-- A candidate's (id, position_id) pair must be unique so it can be the
-- target of a composite foreign key from votes.
alter table candidates
  add constraint candidates_id_position_id_unique unique (id, position_id);

alter table votes
  add constraint votes_candidate_matches_position
  foreign key (candidate_id, position_id)
  references candidates (id, position_id);

create function prevent_vote_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.position_id is distinct from old.position_id then
    raise exception 'votes.position_id cannot be changed once a vote is cast';
  end if;
  if new.voter_id is distinct from old.voter_id then
    raise exception 'votes.voter_id cannot be changed once a vote is cast';
  end if;
  return new;
end;
$$;

create trigger on_vote_identity_change
  before update on votes
  for each row execute procedure prevent_vote_identity_change();
