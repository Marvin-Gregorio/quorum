import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/:path*',
        headers: [
          // Blocks the vote page from being embedded in an iframe for
          // clickjacking/UI-redressing — safe in dev too, nothing here
          // embeds itself.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
        ],
      },
    ];
  },
  // Local dev is commonly opened via 127.0.0.1 (our Supabase OAuth redirect
  // URLs are pinned to it) as well as localhost; Next.js 16 blocks dev-only
  // resource requests (HMR, RSC chunks) from any origin not listed here.
  allowedDevOrigins: ['localhost'],
  images: {
    // Candidate photos are served from Supabase Storage via signed URLs
    // (the bucket is private — RLS governs who can read a given photo),
    // which have the shape /storage/v1/object/sign/..., not /public/... —
    // either <project>.supabase.co (hosted) or the local Supabase CLI's own
    // server (127.0.0.1/localhost:54321) — next/image needs every remote
    // host it fetches from listed explicitly.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/sign/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/sign/**' },
      { protocol: 'http', hostname: 'localhost', port: '54321', pathname: '/storage/v1/object/sign/**' },
    ],
    // Next's SSRF guard blocks image fetches to private IPs by default, which
    // includes the local Supabase CLI at 127.0.0.1 — only needed in dev,
    // since production always serves photos from the public *.supabase.co host.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
};

export default nextConfig;
