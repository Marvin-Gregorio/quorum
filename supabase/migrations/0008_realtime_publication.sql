-- supabase/migrations/0008_realtime_publication.sql
--
-- C2: Realtime never actually streams anything.
--
-- No migration ever added vote_tallies / voter_turnout to the
-- supabase_realtime publication, so the manager's RealtimePanel subscription
-- receives nothing, ever.

alter publication supabase_realtime add table vote_tallies, voter_turnout;
