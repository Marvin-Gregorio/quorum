# Voting System — Design Spec

Date: 2026-09-28

## 1. Overview

A self-service, multi-tenant voting platform. Any signed-in user can create an
"election page" (a self-contained election event with one or more positions
and candidates) and becomes its manager simply by having created it. Voters
sign in with Google or Microsoft, vote once per position (able to change
their vote until the window closes), and results are visible on a live
dashboard. Built on Next.js (client + server) and Supabase (Postgres, Auth,
Storage, Realtime), designed to run entirely within Supabase's free tier.

## 2. Goals

- Self-service election creation; ownership determined solely by who created
  the page — no separate role assignment.
- Google and Microsoft OAuth as the only sign-in methods, for both managers
  and voters.
- Multiple positions per election, each with its own candidate list; one vote
  per voter per position, changeable until the voting window closes.
- Secret ballot: no one, including the page's manager, can read which
  candidate a specific voter chose. The manager can see turnout (who has
  voted per position) but never the choice itself.
- Public landing (candidate list) and results dashboard by default; a
  manager can restrict a page to specific email domains, which then gates
  both the voting link and the results dashboard identically.
- Client-side image compression before candidate photos ever reach Supabase
  Storage.
- Defense-in-depth input handling: sanitize on the client for UX, enforce
  validation/sanitization and all authorization rules server-side (Server
  Actions + RLS), never trusting the client as the security boundary.
- Fit comfortably inside Supabase's free tier (approximate limits at time of
  writing: 500MB Postgres storage, 1GB file storage, ~200 concurrent Realtime
  connections, and a monthly egress allowance — verify current figures
  against Supabase's pricing page at build time, as free-tier limits change).

## 3. Non-goals / out of scope (future considerations)

- Multiple managers/co-owners per page (v1 is single-owner only).
- Automated tie-breaking, ranked-choice or multi-select voting methods.
- CSV/export of results or turnout data.
- Email/SMS reminders or notifications to non-voters.
- Rate-limiting or bot/abuse detection beyond OAuth-based vote uniqueness.
- Internationalization.
- Handling of Supabase free-tier project auto-pausing after 7 days of
  inactivity — an operational concern for whoever hosts a given election,
  not something the architecture itself can prevent.

## 4. Core concepts & roles

- **Page**: one election event. Has a unique slug, a title, a privacy flag,
  a voting window, and is owned by the user who created it.
- **Manager**: the `owner_id` of a page. Not a separate role — created a
  page, therefore manages it; no ownership over any other page.
- **Position**: a single race within a page (e.g. "President"). Belongs to
  one page.
- **Candidate**: belongs to one position, has a name, bio, and photo.
- **Voter**: any authenticated user who is not necessarily the owner,
  interacting with a page's public voting/results surfaces.

## 5. Auth & multi-tenancy model

- Supabase Auth configured with Google and Azure (Microsoft/Entra ID) OAuth
  providers. No password-based accounts.
- A trigger on `auth.users` inserts a mirrored row into `profiles` on first
  sign-in (id, email, full_name, avatar_url).
- Creating a page requires only being authenticated; the creator's
  `auth.uid()` is stored as `owner_id` at creation time. This is the entire
  mechanism for "becoming a manager."
- Voting always requires sign-in, on both public and private pages — this is
  what makes one-vote-per-person-per-position enforceable. "Public" means
  any email domain is accepted; "private" means the voter's email domain
  must appear in that page's `allowed_domains`.
- The private/public flag gates both the voting link (`/vote/[slug]`) and
  the results dashboard (`/results/[slug]`) identically — a private page's
  results are exactly as restricted as its ballot.
- Domain gating is enforced twice: a fast check in Next.js
  middleware/Server Components for UX (immediate redirect with a clear
  message), and the authoritative check inside RLS policies (via a shared
  `is_domain_allowed(page_id, email)` SQL function) so it cannot be bypassed
  by calling Supabase directly.

## 6. Data model

```
profiles
  id (uuid, = auth.uid(), PK)
  email (text)
  full_name (text)
  avatar_url (text)

pages
  id (uuid, PK)
  slug (text, unique)
  title (text)
  owner_id (uuid -> profiles.id)
  is_private (bool, default false)
  voting_starts_at (timestamptz)
  voting_ends_at (timestamptz)
  created_at (timestamptz, default now())

allowed_domains
  page_id (uuid -> pages.id)
  domain (text)
  PRIMARY KEY (page_id, domain)

positions
  id (uuid, PK)
  page_id (uuid -> pages.id)
  title (text)
  display_order (int)

candidates
  id (uuid, PK)
  position_id (uuid -> positions.id)
  name (text)
  bio (text)
  photo_url (text)

votes
  id (uuid, PK)
  voter_id (uuid -> profiles.id)
  position_id (uuid -> positions.id)
  candidate_id (uuid -> candidates.id)
  updated_at (timestamptz)
  UNIQUE (voter_id, position_id)

vote_tallies
  position_id (uuid -> positions.id)
  candidate_id (uuid -> candidates.id)
  vote_count (int, default 0)
  PRIMARY KEY (position_id, candidate_id)

voter_turnout
  page_id (uuid -> pages.id)
  position_id (uuid -> positions.id)
  voter_id (uuid -> profiles.id)
  voted_at (timestamptz)
  PRIMARY KEY (position_id, voter_id)
```

`votes` is intentionally the only table holding the voter→candidate
mapping, and no one is ever granted SELECT on it (see §7). `vote_tallies`
and `voter_turnout` are both maintained exclusively by a trigger function
running as the table owner (`SECURITY DEFINER`), never written to directly
by any client role.

## 7. Vote secrecy & tally architecture

This is the core architectural decision of the system: keep ballots secret,
support real-time results, and stay within the free-tier Realtime
connection budget, simultaneously.

- `votes`: voters can INSERT/UPDATE (upsert) only their own row, only while
  `now()` is within the page's voting window and the page's visibility check
  passes. No SELECT policy exists for any role — not the voter, not the
  page owner. The table exists purely to enforce one-vote-per-position and
  to feed the trigger below.
- An `AFTER INSERT OR UPDATE` trigger on `votes`:
  - Upserts `vote_tallies` (decrementing the previous candidate's count and
    incrementing the new one, when a vote changes).
  - Upserts `voter_turnout` for that `(position_id, voter_id)` pair,
    recording only that the voter has voted for that position — never which
    candidate.
- `vote_tallies` SELECT policy follows the page's public/private visibility
  rule — this is what both the manager's live dashboard and the public
  results page read from.
- `voter_turnout` SELECT policy is owner-only — lets a manager see who has
  or hasn't voted per position, with no way to infer their choice, since the
  choice was never written to this table.
- **Realtime is only used by the manager console**: one Supabase Realtime
  channel per manager session, subscribed to `postgres_changes` on
  `vote_tallies` and `voter_turnout` filtered to that page's rows. This is a
  small, bounded number of concurrent connections (one per active manager),
  never scaling with public viewership.
- **The public results page polls instead of subscribing**: a Next.js Route
  Handler (`/api/results/[slug]`) queries `vote_tallies` (RLS-enforced) and
  the client re-fetches every ~5–8 seconds. However many people load the
  results page, this is ordinary HTTP request volume, not held-open
  sockets — which is the resource that actually has a hard free-tier
  ceiling (~200 concurrent connections). Both surfaces read the same
  rollup tables, so there is no drift between what the manager sees live
  and what the public sees moments later.

### Alternatives considered

- **Direct Realtime on `votes` with client-side aggregation**: simpler
  schema (no trigger, no rollup tables), but secrecy becomes fragile — any
  future RLS relaxation would leak raw candidate choices — and every client
  recomputes aggregation itself, work that grows with vote volume. Rejected
  in favor of the rollup-table approach.
- **`pg_notify` + Edge Function broadcasting**: fully decouples Realtime
  from table RLS via a Broadcast channel, at the cost of deploying and
  maintaining a separate Edge Function (additional free-tier quota, an
  additional moving part) for a decoupling benefit the rollup-table
  approach already achieves without it. Rejected as unnecessary complexity
  for this scale.

## 8. Candidate image pipeline

- Manager selects a photo in the "Add candidate" form. Before upload, the
  browser resizes/compresses it (canvas-based, e.g. via
  `browser-image-compression`): downscaled to a max bound (~800×800px),
  re-encoded as WebP, targeting roughly 150–250KB per photo.
- The compressed file uploads directly from the browser to a Supabase
  Storage bucket (`candidate-photos`) using the anon key — no round-trip
  through a Next.js server, avoiding double egress and server compute.
- Storage policies: INSERT/UPDATE/DELETE restricted to the owner of the
  candidate's parent page (same ownership join used elsewhere); public
  read, since candidate photos appear on the public voting page.

## 9. Input handling & sanitization

- Client-side: form fields are trimmed and stripped of HTML before submit,
  primarily for UX (immediate feedback), not as the security boundary.
- Server-side (the actual boundary): Next.js Server Actions validate every
  candidate/position/page field with a Zod schema (length limits, allowed
  characters) and run free-text fields through an HTML sanitizer (e.g.
  `sanitize-html` configured to strip all tags) before any Supabase insert.
- Supabase's client libraries already parameterize queries, so classic SQL
  injection isn't a distinct vector here; sanitization is specifically
  about preventing stored XSS in candidate names/bios that would otherwise
  render on the public candidate list.

## 10. Voting flow

1. Voter signs in (Google/Microsoft) and lands on `/vote/[slug]`, passing
   the public/domain gate described in §5.
2. For each position, the voter selects one candidate and submits via a
   Server Action that upserts `votes` on `(voter_id, position_id)` —
   resubmitting before the window closes simply changes their prior choice.
3. The write is rejected by RLS if `now()` falls outside
   `[voting_starts_at, voting_ends_at]`, enforced at the database level so
   a stale page load or a direct API call cannot sneak in a late vote.
4. On success, the trigger updates `vote_tallies` and `voter_turnout`.
5. The UI reflects "you voted for President" per position based on the
   Server Action's own response — it never re-reads `votes` to confirm,
   since no one (including the voter) is granted SELECT on that table.

## 11. Routes (Next.js App Router)

```
/                            landing/marketing + "sign in to create an election"
/create                      (auth required) new page wizard
/manage/[slug]                manager console: positions, candidates, domains,
                              turnout, live tallies
/manage/[slug]/candidates     add/edit candidates (image upload)
/vote/[slug]                  public candidate list + ballot (auth + domain gate)
/results/[slug]                public live results (domain gate only if private)
```

## 12. Testing strategy

- RLS policies are the highest-risk surface (secrecy + domain-gating):
  cover with SQL-level tests (e.g. pgTAP, or a script driving multiple
  JWT-scoped Supabase clients) asserting a voter cannot read another
  voter's ballot, a non-matching-domain user is denied on a private page,
  and tallies update correctly when a vote changes.
- Server Actions (sanitization, voting-window enforcement) get standard
  unit tests against a mocked Supabase client.
- One end-to-end smoke test (Playwright): create a page, add a candidate,
  cast a vote, confirm the tally updates on the results page.

## 13. Free-tier budget summary

- **DB storage**: rows are small fixed-width records (uuids, short text,
  counts); even thousands of voters across many elections stays well under
  the free tier's Postgres storage limit.
- **File storage**: compressed WebP candidate photos (~150–250KB each) keep
  total usage a small fraction of the free tier's file storage limit even
  at hundreds of candidates.
- **Realtime connections**: bounded by the number of managers actively
  viewing their own console at once, not by public result-page viewership —
  the one number that could spike is kept off the connection budget
  entirely by design (§7).
- **Egress**: the polling payload is just `{position_id, candidate_id,
  count}` rows, a few KB per request; a 5–8s polling interval keeps this
  well within a typical monthly egress allowance even with a few hundred
  concurrent result-page viewers.
