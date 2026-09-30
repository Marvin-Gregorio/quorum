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
  const { data: userData } = await supabase.auth.getUser();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (!page) redirect('/');

  const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
  if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/vote/${ownerId}/${slug}`)}`);
  if (access === 'restricted') redirect(`/access-restricted?pageId=${page.id}`);

  const ballot = await getBallot(supabase, ownerId, slug, userData.user!.id);
  if (!ballot) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user!.id).single();

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
        <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user!.email ?? null} />
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
