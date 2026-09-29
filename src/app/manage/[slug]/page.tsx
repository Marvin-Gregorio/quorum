import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getManagedElection } from '@/lib/queries/manage';
import { RealtimePanel, type Tally, type Turnout } from './realtime-panel';

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  // A signed-out visitor hits RLS before ever seeing this page's row: a
  // private page's "pages" select policy returns nothing for the anon role,
  // so getManagedElection below would come back null regardless of whether
  // the page actually exists, which previously sent every signed-out
  // visitor to '/' instead of prompting them to sign in. Check sign-in
  // status first so that case is distinguishable.
  if (!userData.user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/manage/${slug}`)}`);
  }

  const election = await getManagedElection(supabase, slug);
  if (!election) redirect('/');

  const access = await checkPageAccess(
    supabase,
    { id: election.id, is_private: election.isPrivate, owner_id: election.ownerId },
    userData.user.id,
    userData.user.email ?? null
  );
  if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/manage/${slug}`)}`);
  if (access === 'restricted' || userData.user.id !== election.ownerId) redirect('/access-restricted');

  const positionIds = election.positions.map((p) => p.id);

  const { data: tallyRows } = positionIds.length
    ? await supabase
        .from('vote_tallies')
        .select('position_id, candidate_id, vote_count')
        .in('position_id', positionIds)
    : { data: [] };
  const { data: turnoutRows } = await supabase
    .from('voter_turnout')
    .select('position_id, voter_id')
    .eq('page_id', election.id);

  const initialTallies: Tally[] = (tallyRows ?? []).map((t: any) => ({
    positionId: t.position_id,
    candidateId: t.candidate_id,
    voteCount: t.vote_count,
  }));
  const initialTurnout: Turnout[] = (turnoutRows ?? []).map((t: any) => ({
    positionId: t.position_id,
    voterId: t.voter_id,
  }));

  return (
    <div>
      <h1>{election.title}</h1>
      <p>{election.organizationName}</p>
      {/* TODO: the positions/candidates roster and settings modal are not
          built yet. The actions in ./actions.ts and the data shape in
          ManagedElection (positions[] with nested candidates) exist, but no
          UI here calls createPositionAction/updateCandidateAction/etc. or
          opens a settings/candidate modal. */}
      <RealtimePanel
        pageId={election.id}
        positionIds={positionIds}
        initialTallies={initialTallies}
        initialTurnout={initialTurnout}
      />
    </div>
  );
}
