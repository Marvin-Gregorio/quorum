import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/services/results';
import { Header } from '@/components/header';
import { LiveResults } from './live-results';
import { BREADCRUMB_LIST, BREADCRUMB_LINK } from '@/lib/ui-classes';

export default async function ResultsPage({ params }: { params: Promise<{ ownerId: string; slug: string }> }) {
  const { ownerId, slug } = await params;
  const supabase = await createServerSupabaseClient();

  // A private page's "pages" select policy hides the row entirely from an
  // unauthenticated or wrong-domain visitor, so a plain RLS-gated lookup here
  // can't tell "doesn't exist" apart from "exists but you can't see it yet" —
  // it would send everyone straight to '/' before ever getting a chance to
  // redirect to sign-in or access-restricted. This RPC bypasses RLS just far
  // enough to answer those two questions (existence + privacy), nothing more.
  const { data: pageRows } = await supabase.rpc('find_page_by_owner_slug', {
    p_owner_id: ownerId,
    p_slug: slug,
  });
  const pageInfo = pageRows?.[0];
  if (!pageInfo) redirect('/');

  const { data: userData } = await supabase.auth.getUser();
  const page = { id: pageInfo.page_id, is_private: pageInfo.is_private, owner_id: ownerId };

  if (page.is_private) {
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/results/${ownerId}/${slug}`)}`);
    if (access === 'restricted') {
      const next = encodeURIComponent(`/results/${ownerId}/${slug}`);
      redirect(`/access-restricted?pageId=${page.id}&next=${next}`);
    }
  }

  const snapshot = await getResultsSnapshot(supabase, ownerId, slug);
  if (!snapshot) redirect('/');

  const isOwner = userData.user?.id === page.owner_id;

  return (
    <>
      <Header />

      <nav aria-label="Breadcrumb" className="max-w-[820px] w-full mx-auto pt-4 px-6 pb-0">
        <ol className={BREADCRUMB_LIST}>
          <li>
            <Link href="/" className={BREADCRUMB_LINK}>Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            Results
          </li>
        </ol>
      </nav>

      <LiveResults ownerId={ownerId} slug={slug} initialSnapshot={snapshot} isOwner={isOwner} />
    </>
  );
}
