import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { buildContentSecurityPolicy, generateNonce } from '@/lib/csp';

export async function middleware(request: NextRequest) {
  // Production-only: Next's dev-mode HMR/React Refresh needs 'unsafe-eval'
  // and other allowances a strict policy would break.
  const csp = process.env.NODE_ENV === 'production' ? buildContentSecurityPolicy(generateNonce()) : null;

  // Next parses the nonce out of the *request's* CSP header at render time
  // to stamp its own inline scripts, so it must be set there as well as on
  // the response. Rebuilt in setAll below because that swaps the response.
  const nextResponse = () => {
    if (!csp) return NextResponse.next({ request });
    const headers = new Headers(request.headers);
    headers.set('Content-Security-Policy', csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  let response = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
