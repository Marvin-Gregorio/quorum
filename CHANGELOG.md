# voting-system-impl

## 0.3.0

### Minor Changes

- 3aeae27: Security hardening: clickjacking/security headers, cached public results polling, tightened allowed_domains RLS, and made candidate photos private (signed URLs instead of a public bucket, which had been bypassing RLS entirely).

### Patch Changes

- 83108da: Add targeted rate limiting (via Upstash Redis, optional/no-op without credentials) for election creation, voting, and public results polling — the highest-risk actions for shared free-tier resource exhaustion.

## 0.2.0

### Minor Changes

- c955f67: initial open source entry
