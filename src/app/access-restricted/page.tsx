import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/user-menu';

export default async function AccessRestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  let heading = 'You do not have access to this election.';
  if (slug) {
    const { data: page } = await supabase.from('pages').select('id, is_private').eq('slug', slug).maybeSingle();
    if (page?.is_private) {
      const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', page.id);
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
            <Link href="/sign-in" className="primary-btn" style={{ padding: '14px 28px', fontSize: 15 }}>
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
