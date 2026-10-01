import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getManagedElection } from '@/services/manage';
import { Header } from '@/components/header';
import { ManageConsole, type Tally, type Turnout } from './manage-console';
import { BREADCRUMB_LIST, BREADCRUMB_LINK } from '@/lib/ui-classes';

export default async function ManagePage({ params }: { params: Promise<{ ownerId: string; slug: string }> }) {
  const { ownerId, slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  // A signed-out visitor hits RLS before ever seeing this page's row: a
  // private page's "pages" select policy returns nothing for the anon role,
  // so getManagedElection below would come back null regardless of whether
  // the page actually exists, which previously sent every signed-out
  // visitor to '/' instead of prompting them to sign in. Check sign-in
  // status first so that case is distinguishable.
  if (!userData.user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/manage/${ownerId}/${slug}`)}`);
  }

  const election = await getManagedElection(supabase, ownerId, slug);
  if (!election) redirect('/');

  const access = await checkPageAccess(
    supabase,
    { id: election.id, is_private: election.isPrivate, owner_id: election.ownerId },
    userData.user.id,
    userData.user.email ?? null
  );
  if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/manage/${ownerId}/${slug}`)}`);
  if (access === 'restricted' || userData.user.id !== election.ownerId) redirect(`/access-restricted?pageId=${election.id}`);

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

  const initialTallies: Tally[] = (tallyRows ?? []).map((t) => ({
    positionId: t.position_id,
    candidateId: t.candidate_id,
    voteCount: t.vote_count,
  }));
  const initialTurnout: Turnout[] = (turnoutRows ?? []).map((t) => ({
    positionId: t.position_id,
    voterId: t.voter_id,
  }));

  return (
    <>
      <Header />

      <nav aria-label="Breadcrumb" className="max-w-[900px] w-full mx-auto pt-4 px-6 pb-0">
        <ol className={BREADCRUMB_LIST}>
          <li>
            <Link href="/" className={BREADCRUMB_LINK}>Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/profile" className={BREADCRUMB_LINK}>Profile</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {election.title}
          </li>
        </ol>
      </nav>

      <ManageConsole
        pageId={election.id}
        ownerId={election.ownerId}
        slug={election.slug}
        organizationName={election.organizationName}
        title={election.title}
        votingStartsAt={election.votingStartsAt}
        votingEndsAt={election.votingEndsAt}
        isPrivate={election.isPrivate}
        domains={election.domains}
        positions={election.positions}
        positionIds={positionIds}
        initialTallies={initialTallies}
        initialTurnout={initialTurnout}
      />
    </>
  );
}
