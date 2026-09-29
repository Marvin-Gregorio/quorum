import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getManagedElection } from '@/lib/queries/manage';

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

  return (
    <div>
      <h1>{election.title}</h1>
      <p>{election.organizationName}</p>
      {/* Positions/candidates roster, settings modal, and the Realtime tally
          panel (Task 18/19's actions, this task's data) port directly from
          the validated Manage.dc.html design — its state shape (positions
          array with nested candidates, candidateModal/settingsModal) maps
          onto ManagedElection one for one. */}
    </div>
  );
}
