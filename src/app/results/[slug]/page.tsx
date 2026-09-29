import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/lib/queries/results';
import { LiveResults } from './live-results';

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) redirect('/');

  if (page.is_private) {
    const { data: userData } = await supabase.auth.getUser();
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access === 'sign-in') redirect('/sign-in');
    if (access === 'restricted') redirect('/access-restricted');
  }

  const snapshot = await getResultsSnapshot(supabase, slug);
  if (!snapshot) redirect('/');

  return <LiveResults slug={slug} initialSnapshot={snapshot} />;
}
