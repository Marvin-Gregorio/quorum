import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/user-menu';

// Only a same-origin relative path is a safe redirect target — see
// auth/callback/route.ts's isSafeNextPath for the same rule and rationale.
function isSafeNextPath(next: string | undefined): next is string {
  return !!next && next.startsWith('/') && !next.startsWith('//');
}

export default async function AccessRestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ pageId?: string; next?: string }>;
}) {
  const { pageId, next } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  let heading = 'You do not have access to this election.';
  if (pageId) {
    // A rejected visitor is, by definition, someone the "pages" select policy
    // hides this row from — a plain RLS-gated lookup would come back null
    // here every time, so this reliably needs to bypass RLS just to learn
    // is_private (nothing else).
    const { data: isPrivate } = await supabase.rpc('get_page_privacy', { p_page_id: pageId });
    if (isPrivate) {
      const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', pageId);
      const domainList = (domainRows ?? []).map((d) => d.domain);
      heading = domainList.length
        ? `This election is only open to ${domainList.join(', ')}`
        : 'This election is only open to its creator.';
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '28px clamp(24px,5vw,64px)',
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>
          Quorum
        </div>
        {userData.user && <UserMenu name={null} email={userData.user.email ?? null} />}
      </header>

      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            role="img"
            aria-label="A stamp marked not eligible"
            style={{ margin: '0 auto 32px', display: 'block' }}
          >
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--seal)" strokeWidth="3" opacity="0.85" />
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--seal)" strokeWidth="1.5" opacity="0.85" />
            <text
              x="60"
              y="56"
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontWeight="700"
              fontSize="15"
              fill="var(--seal)"
              opacity="0.85"
              transform="rotate(-10 60 56)"
            >
              NOT ELIGIBLE
            </text>
            <text
              x="60"
              y="76"
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontStyle="italic"
              fontSize="11"
              fill="var(--seal)"
              opacity="0.85"
              transform="rotate(-10 60 76)"
            >
              Quorum
            </text>
          </svg>

          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{heading}</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, margin: '0 0 32px' }}>
            {userData.user?.email
              ? `You're signed in as ${userData.user.email}. Ask the organizer to add your email domain, or sign in with a different account.`
              : 'Ask the organizer to add your email domain, or sign in with a different account.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <Link
              href={isSafeNextPath(next) ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
              className="primary-btn"
              style={{ padding: '14px 28px', fontSize: 15 }}
            >
              Sign in with a different account
            </Link>
            <Link href="/" style={{ fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Return home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
