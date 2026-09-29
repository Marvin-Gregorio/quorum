import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/lib/queries/results';
import { UserMenu } from '@/components/user-menu';
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

  const { data: userData } = await supabase.auth.getUser();

  if (page.is_private) {
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access === 'sign-in') redirect(`/sign-in?next=${encodeURIComponent(`/results/${slug}`)}`);
    if (access === 'restricted') redirect(`/access-restricted?slug=${slug}`);
  }

  const snapshot = await getResultsSnapshot(supabase, slug);
  if (!snapshot) redirect('/');

  const profile = userData.user
    ? (await supabase.from('profiles').select('*').eq('id', userData.user.id).single()).data
    : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px clamp(24px,5vw,64px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 20 }}>
          Quorum
        </div>
        {userData.user ? (
          <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user.email ?? null} />
        ) : (
          <Link href="/sign-in" className="signin-btn">
            Sign in
          </Link>
        )}
      </header>

      <nav aria-label="Breadcrumb" style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '16px 24px 0' }}>
        <ol className="breadcrumb-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--ink)' }}>
            Results
          </li>
        </ol>
      </nav>

      <LiveResults slug={slug} initialSnapshot={snapshot} />
    </div>
  );
}
