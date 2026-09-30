import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev is commonly opened via 127.0.0.1 (our Supabase OAuth redirect
  // URLs are pinned to it) as well as localhost; Next.js 16 blocks dev-only
  // resource requests (HMR, RSC chunks) from any origin not listed here.
  allowedDevOrigins: ['localhost'],
  images: {
    // Candidate photos are served from Supabase Storage's public bucket URL,
    // which is either <project>.supabase.co (hosted) or the local Supabase
    // CLI's own server (127.0.0.1/localhost:54321) — next/image needs every
    // remote host it fetches from listed explicitly.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      { protocol: 'http', hostname: 'localhost', port: '54321', pathname: '/storage/v1/object/public/**' },
    ],
    // Next's SSRF guard blocks image fetches to private IPs by default, which
    // includes the local Supabase CLI at 127.0.0.1 — only needed in dev,
    // since production always serves photos from the public *.supabase.co host.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
};

export default nextConfig;
