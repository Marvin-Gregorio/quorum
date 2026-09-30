import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Only a same-origin relative path is a safe redirect target: it must start
// with a single '/' and not '//' (protocol-relative, e.g. "//evil.com") or
// an absolute URL (e.g. "https://evil.com"), otherwise a crafted `next`
// value could send a signed-in user to an attacker's site (open redirect).
function isSafeNextPath(next: string | null | undefined): next is string {
  return !!next && next.startsWith('/') && !next.startsWith('//');
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // The query param is the primary carrier; the cookie (set by the sign-in
  // page right before handing off to the OAuth provider) is a fallback for
  // when that round trip doesn't preserve the query string.
  const cookieStore = await cookies();
  const rawCookieNext = cookieStore.get('post_auth_redirect')?.value;
  const cookieNext = rawCookieNext ? decodeURIComponent(rawCookieNext) : undefined;
  cookieStore.delete('post_auth_redirect');

  const destination = isSafeNextPath(next)
    ? next
    : isSafeNextPath(cookieNext)
      ? cookieNext
      : '/profile';
  return NextResponse.redirect(`${origin}${destination}`);
}
