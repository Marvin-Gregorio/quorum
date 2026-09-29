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
  if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/vote/${slug}`)}`);
  if (access === 'restricted') redirect('/access-restricted');

  const ballot = await getBallot(supabase, slug, userData.user!.id);
  if (!ballot) redirect('/');

  return (
    <div>
      <h1>{ballot.title}</h1>
      <p>{ballot.organizationName}</p>
      {/* TODO: the position/candidate radio-bubble ballot rows and the
          sticky "Cast your vote" bar are not built yet. ballot.positions[]
          (with selectedCandidateId already carrying a returning voter's
          prior choice, per spec §10) is fetched above, but nothing renders
          it or calls the vote-casting action in ./actions.ts. */}
    </div>
  );
}
