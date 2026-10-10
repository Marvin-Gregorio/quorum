export function generateNonce() {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

// Every third-party origin the app actually loads from: Google Fonts
// (the <link> in layout.tsx), devicon's CDN import (globals.css), and
// Supabase (API/Storage over https, Realtime over wss).
// Scripts are nonce-gated because Next.js streams the RSC payload into
// inline <script> tags; 'self' alone blocks them and breaks hydration.
export function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
