---
"voting-system-impl": minor
---

Security hardening: clickjacking/security headers, cached public results polling, tightened allowed_domains RLS, and made candidate photos private (signed URLs instead of a public bucket, which had been bypassing RLS entirely).
