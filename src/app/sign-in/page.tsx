'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const supabase = createBrowserSupabaseClient();

  async function signInWith(provider: 'google' | 'azure') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
            <button type="button" onClick={() => signInWith('google')}>
              Continue with Google
            </button>
            <button type="button" onClick={() => signInWith('azure')}>
              Continue with Microsoft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
