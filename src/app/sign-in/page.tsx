'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const supabase = createBrowserSupabaseClient();

  async function signInWith(provider: 'google' | 'azure') {
    // Thread the caller's intended destination (e.g. a voter who followed a
    // link to /vote/some-slug and had to sign in first) through the OAuth
    // round trip as a `next` query param, so the callback route can send
    // them back to it instead of always landing on /profile.
    const next = new URLSearchParams(window.location.search).get('next');
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (next) callbackUrl.searchParams.set('next', next);

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
        // Azure/Microsoft requires the `email` scope to actually return an
        // email claim (per Supabase's Azure provider docs); Google returns
        // it without an extra scope.
        ...(provider === 'azure' ? { scopes: 'email' } : {}),
      },
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '28px clamp(24px,5vw,64px)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>
          Quorum
        </div>
      </header>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Sign in to Quorum</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, margin: '0 0 32px' }}>
            Sign in to vote, or to create and manage an election.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button type="button" className="oauth-btn" onClick={() => signInWith('google')}>
              <span className="g-mark">G</span>
              Continue with Google
            </button>
            <button type="button" className="oauth-btn" onClick={() => signInWith('azure')}>
              <span className="ms-mark">
                <span style={{ background: 'var(--ink-2)' }} />
                <span style={{ background: 'var(--seal)' }} />
                <span style={{ background: 'var(--ledger)' }} />
                <span style={{ background: 'var(--line-strong)' }} />
              </span>
              Continue with Microsoft
            </button>
          </div>

          <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6, margin: '28px 0 0' }}>
            Your email address is only used to confirm you&apos;re eligible to vote — Quorum never posts on your
            behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
