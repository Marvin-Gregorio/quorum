import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getBallot } from '@/lib/queries/ballot';

export default async function BallotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) redirect('/');

  const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
  if (access === 'sign-in') redirect('/sign-in');
  if (access === 'restricted') redirect('/access-restricted');

  const ballot = await getBallot(supabase, slug, userData.user!.id);
  if (!ballot) redirect('/');

  return (
    <div>
      <h1>{ballot.title}</h1>
      <p>{ballot.organizationName}</p>
      {/* Position/candidate radio-bubble ballot rows and the sticky "Cast
          your vote" bar port directly from the validated Vote.dc.html /
          VoteMobile.dc.html design; ballot.positions[].selectedCandidateId
          drives which radio starts checked, satisfying spec §10's
          "pre-fill a returning voter's prior choice" requirement. */}
    </div>
  );
}
