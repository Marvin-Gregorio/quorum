import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Only a same-origin relative path is a safe redirect target: it must start
// with a single '/' and not '//' (protocol-relative, e.g. "//evil.com") or
// an absolute URL (e.g. "https://evil.com"), otherwise a crafted `next`
// value could send a signed-in user to an attacker's site (open redirect).
function isSafeNextPath(next: string | null): next is string {
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

  const destination = isSafeNextPath(next) ? next : '/profile';
  return NextResponse.redirect(`${origin}${destination}`);
}
