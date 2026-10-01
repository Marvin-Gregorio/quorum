---
"voting-system-impl": patch
---

Add targeted rate limiting (via Upstash Redis, optional/no-op without credentials) for election creation, voting, and public results polling — the highest-risk actions for shared free-tier resource exhaustion.
