-- supabase/migrations/0015_explicit_table_grants.sql
--
-- Bug: on a hosted project, every query against a public table failed with
-- `42501 permission denied for table pages` (same for positions, candidates,
-- ...). That's a missing table-level GRANT, which Postgres checks *before*
-- RLS is evaluated -- so none of the policies in 0003-0005 were ever reached.
-- The earlier migrations only enabled RLS and never granted anything,
-- relying on Supabase's default privileges for the anon/authenticated roles,
-- which the local CLI stack applies but a hosted project may not.
--
-- Grant exactly what RLS already intends, no more. RLS stays the real
-- boundary; these grants only let a request reach it.
--
-- Deliberately NOT granted to any client role:
--   * insert/update/delete on vote_tallies and voter_turnout -- written only
--     by the maintain_vote_rollups() security-definer trigger.
--   * delete on votes -- a vote is changed (upsert), never retracted.
--   * any privilege on votes for anon -- the secret ballot is readable only
--     by the signed-in voter who cast it.

-- Anonymous visitors: the public results poll (api/results route) reads a
-- public page's structure and tallies without a session.
grant select on pages, positions, candidates, vote_tallies to anon;

grant select, insert, update, delete on pages, positions, candidates to authenticated;
grant select, insert, delete on allowed_domains to authenticated;
grant select on profiles, vote_tallies, voter_turnout to authenticated;
grant select, insert, update on votes to authenticated;
