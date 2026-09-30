import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getBallot } from '@/lib/queries/ballot';
import { UserMenu } from '@/components/user-menu';
import { BallotForm } from './ballot-form';

export default async function BallotPage({ params }: { params: Promise<{ ownerId: string; slug: string }> }) {
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

  // Voting always requires sign-in, regardless of public/private (spec §5).
  if (!userData.user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/vote/${ownerId}/${slug}`)}`);
  }

  const page = { id: pageInfo.page_id, is_private: pageInfo.is_private, owner_id: ownerId };
  const access = await checkPageAccess(supabase, page, userData.user.id, userData.user.email ?? null);
  if (access === 'restricted') {
    const next = encodeURIComponent(`/vote/${ownerId}/${slug}`);
    redirect(`/access-restricted?pageId=${page.id}&next=${next}`);
  }

  const ballot = await getBallot(supabase, ownerId, slug, userData.user.id);
  if (!ballot) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px clamp(24px,5vw,64px)',
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 20 }}>
          Quorum
        </div>
        <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user.email ?? null} />
      </header>

      <nav aria-label="Breadcrumb" style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '16px 24px 0' }}>
        <ol className="breadcrumb-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--ink)' }}>
            Ballot
          </li>
        </ol>
      </nav>

      <BallotForm ballot={ballot} />
    </div>
  );
}
