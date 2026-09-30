import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev is commonly opened via 127.0.0.1 (our Supabase OAuth redirect
  // URLs are pinned to it) as well as localhost; Next.js 16 blocks dev-only
  // resource requests (HMR, RSC chunks) from any origin not listed here.
  allowedDevOrigins: ['localhost'],
};

export default nextConfig;
