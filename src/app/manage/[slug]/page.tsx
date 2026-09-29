import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getManagedElection } from '@/lib/queries/manage';
import { RealtimePanel, type Tally, type Turnout } from './realtime-panel';

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const election = await getManagedElection(supabase, slug);
  if (!election) redirect('/');

  const access = await checkPageAccess(
    supabase,
    { id: election.id, is_private: election.isPrivate, owner_id: election.ownerId },
    userData.user?.id ?? null,
    userData.user?.email ?? null
  );
  if (access === 'sign-in') redirect('/sign-in');
  if (access === 'restricted' || userData.user?.id !== election.ownerId) redirect('/access-restricted');

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
      {/* Positions/candidates roster and settings modal (Task 18's actions,
          this task's data) port directly from the validated Manage.dc.html
          design — its state shape (positions array with nested candidates,
          candidateModal/settingsModal) maps onto ManagedElection one for one. */}
      <RealtimePanel
        pageId={election.id}
        positionIds={positionIds}
        initialTallies={initialTallies}
        initialTurnout={initialTurnout}
      />
    </div>
  );
}
