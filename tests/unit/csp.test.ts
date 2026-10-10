import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { buildContentSecurityPolicy, generateNonce } from '@/lib/csp';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

describe('buildContentSecurityPolicy', () => {
  it('allows scripts only via the nonce, never unsafe-inline', () => {
    const csp = buildContentSecurityPolicy('abc123');
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('allows blob: images for the client-side candidate photo preview', () => {
    const csp = buildContentSecurityPolicy('abc123');
    const imgSrc = csp.split('; ').find((d) => d.startsWith('img-src'))!;
    expect(imgSrc.split(' ')).toContain('blob:');
  });

  it('keeps the non-script directives', () => {
    const csp = buildContentSecurityPolicy('abc123');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('connect-src');
  });
});

describe('generateNonce', () => {
  it('is unique per call', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe('middleware CSP', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  });

  it('sets a per-request nonce CSP on the response in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { middleware } = await import('@/middleware');
    const res = await middleware(new NextRequest('https://example.com/sign-in'));
    const csp = res.headers.get('content-security-policy')!;
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    // Next reads the nonce from the *request* CSP header to stamp its inline scripts.
    expect(res.headers.get('x-middleware-request-content-security-policy')).toContain(`'nonce-${nonce}'`);
  });

  it('sets no CSP outside production (dev HMR needs eval)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { middleware } = await import('@/middleware');
    const res = await middleware(new NextRequest('https://example.com/'));
    expect(res.headers.get('content-security-policy')).toBeNull();
  });
});
