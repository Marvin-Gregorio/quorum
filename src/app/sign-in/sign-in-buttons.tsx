'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function SignInButtons() {
  const supabase = createBrowserSupabaseClient();

  async function signInWith(provider: 'google' | 'azure') {
    // Thread the caller's intended destination (e.g. a voter who followed a
    // link to /vote/some-slug and had to sign in first) through the OAuth
    // round trip as a `next` query param, so the callback route can send
    // them back to it instead of always landing on /profile.
    const next = new URLSearchParams(window.location.search).get('next');
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (next) {
      callbackUrl.searchParams.set('next', next);
      // Backs up the query-param round trip above: OAuth providers and the
      // Supabase redirect-URL allow-list are the fussier path for
      // preserving query strings end-to-end, so also stash the destination
      // in a short-lived cookie the callback route can fall back to.
      document.cookie = `post_auth_redirect=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
    }

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
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="flex items-center gap-[14px] w-full px-5 py-[14px] border border-ink rounded-[3px] bg-paper text-[15px] font-medium text-ink cursor-pointer no-underline box-border transition-colors duration-150 ease-in-out hover:bg-paper-2"
        onClick={() => signInWith('google')}
      >
          <i className="devicon-google-plain"></i>
          Continue with Google
      </button>
      <button
        type="button"
        className="flex items-center gap-[14px] w-full px-5 py-[14px] border border-ink rounded-[3px] bg-paper text-[15px] font-medium text-ink cursor-pointer no-underline box-border transition-colors duration-150 ease-in-out hover:bg-paper-2"
        onClick={() => signInWith('azure')}
      >
        <span className="inline-grid grid-cols-[8px_8px] grid-rows-[8px_8px] gap-0.5 w-[18px] h-[18px] shrink-0">
          <span className="bg-ink-2" />
          <span className="bg-seal" />
          <span className="bg-ledger" />
          <span className="bg-line-strong" />
        </span>
        Continue with Microsoft
      </button>
    </div>
  );
}
