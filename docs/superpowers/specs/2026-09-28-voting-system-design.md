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
- Positions and candidates can only be added or removed before voting opens;
  once the window starts (or after it ends), that structure is frozen, so a
  candidate can't be added or disqualified mid-election.
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

- **Page**: one election event. Has a unique slug, an organization name, a
  title, a privacy flag, a voting window, and is owned by the user who
  created it. `organization_name` is a free-text field shown above the
  election title everywhere (ballot, results, manager console, profile
  list) — it's denormalized per page rather than backed by a shared
  "organization" entity, matching the rest of this design's single-owner
  simplicity. A manager running several elections for the same
  organization types the same name each time; nothing enforces they
  match. If that drift becomes a real problem, normalizing to a shared
  `organizations` table (id, name, owner_id) that pages reference is the
  natural follow-up — not built now, since nothing in the brief asked for
  multi-election organization management.
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
- The private/public flag gates both the voting link (`/vote/[ownerId]/[slug]`) and
  the results dashboard (`/results/[ownerId]/[slug]`) identically — a private page's
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
  organization_name (text)
  title (text)
  owner_id (uuid -> profiles.id)
  is_private (bool, default false)
  voting_starts_at (timestamptz)
  voting_ends_at (timestamptz)
  created_at (timestamptz, default now())

allowed_domains
  page_id (uuid -> pages.id, ON DELETE CASCADE)
  domain (text)
  PRIMARY KEY (page_id, domain)

positions
  id (uuid, PK)
  page_id (uuid -> pages.id, ON DELETE CASCADE)
  title (text)
  display_order (int)

candidates
  id (uuid, PK)
  position_id (uuid -> positions.id, ON DELETE CASCADE)
  name (text)
  bio (text)
  photo_url (text)

votes
  id (uuid, PK)
  voter_id (uuid -> profiles.id)
  position_id (uuid -> positions.id, ON DELETE CASCADE)
  candidate_id (uuid -> candidates.id, ON DELETE CASCADE)
  updated_at (timestamptz)
  UNIQUE (voter_id, position_id)

vote_tallies
  position_id (uuid -> positions.id, ON DELETE CASCADE)
  candidate_id (uuid -> candidates.id, ON DELETE CASCADE)
  vote_count (int, default 0)
  PRIMARY KEY (position_id, candidate_id)

voter_turnout
  page_id (uuid -> pages.id, ON DELETE CASCADE)
  position_id (uuid -> positions.id, ON DELETE CASCADE)
  voter_id (uuid -> profiles.id)
  voted_at (timestamptz)
  PRIMARY KEY (position_id, voter_id)
```

Deleting a position cascades to its candidates, and from there to any
`votes`/`vote_tallies`/`voter_turnout` rows referencing them — though in
practice those should always be empty when a deletion is allowed at all,
since deletion is only permitted before voting opens (§14).

`votes` is intentionally the only table holding the voter→candidate
mapping. The only SELECT access anyone has on it is a voter reading their
own row (see §7) — no one else, including the page owner, can read any row
in this table. `vote_tallies` and `voter_turnout` are both maintained
exclusively by a trigger function running as the table owner (`SECURITY
DEFINER`), never written to directly by any client role.

## 7. Vote secrecy & tally architecture

This is the core architectural decision of the system: keep ballots secret,
support real-time results, and stay within the free-tier Realtime
connection budget, simultaneously.

- `votes`: voters can INSERT/UPDATE (upsert) only their own row, only while
  `now()` is within the page's voting window and the page's visibility check
  passes. The **only** SELECT policy is `USING (voter_id = auth.uid())` — a
  voter can read back their own current vote, and nobody else (including the
  page owner) has any SELECT access to this table at all. This doesn't
  weaken secrecy: secrecy means hiding a voter's choice from *other people*,
  not from themselves, and it's what lets the ballot page pre-fill a voter's
  prior choice if they leave and come back before the window closes.
  Note that the upsert itself doesn't depend on this SELECT policy to begin
  with — Postgres RLS policies are evaluated per command, so the INSERT and
  UPDATE policies' own `USING`/`WITH CHECK` clauses are what let
  `INSERT ... ON CONFLICT (voter_id, position_id) DO UPDATE` resolve and
  apply, entirely independent of whatever SELECT access exists.
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
- **Realtime is used by the manager console, and by the results page when
  its viewer is that election's owner**: one Supabase Realtime channel per
  such session, subscribed to `postgres_changes` on `vote_tallies` (and,
  for the manager console only, `voter_turnout`) filtered to that page's
  rows. This is a small, bounded number of concurrent connections (one per
  active manager), never scaling with public viewership.
- **Everyone else on the results page polls instead of subscribing**: a
  Next.js Route Handler (`/api/results/[ownerId]/[slug]`) queries
  `vote_tallies` (RLS-enforced) and the client re-fetches every ~5–8
  seconds. However many people load the results page, this is ordinary
  HTTP request volume, not held-open sockets — which is the resource that
  actually has a hard free-tier ceiling (~200 concurrent connections). Both
  surfaces read the same rollup tables, so there is no drift between what
  the manager sees live and what the public sees moments later.

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

1. Voter signs in (Google/Microsoft) and lands on `/vote/[ownerId]/[slug]`, passing
   the public/domain gate described in §5.
2. For each position, the voter selects one candidate and submits via a
   Server Action that upserts `votes` on `(voter_id, position_id)` —
   resubmitting before the window closes simply changes their prior choice.
3. The write is rejected by RLS if `now()` falls outside
   `[voting_starts_at, voting_ends_at]`, enforced at the database level so
   a stale page load or a direct API call cannot sneak in a late vote.
4. On success, the trigger updates `vote_tallies` and `voter_turnout`.
5. The UI reflects "you voted for President" per position based on the
   Server Action's own response, without a round-trip read. Separately, the
   ballot page's initial load *does* query `votes` for that voter's own rows
   (allowed under the self-only SELECT policy in §6/§7) so that a returning
   voter sees their prior choice pre-selected per position, rather than the
   ballot looking unanswered just because the page was reloaded.

## 11. Routes (Next.js App Router)

```
/                                   landing/marketing + "sign in to create an election"
/create                            (auth required) new page wizard
/manage/[ownerId]/[slug]           manager console: positions, candidates, domains,
                                    turnout, live tallies
/vote/[ownerId]/[slug]             public candidate list + ballot (auth + domain gate)
/results/[ownerId]/[slug]          public live results (domain gate only if private);
                                    realtime for the owner, polling for everyone else
```

Pages are identified by `(owner_id, slug)`, not `slug` alone — `pages.slug`
is unique per owner, not globally, so two different managers can each have
their own election at the same slug.

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

## 14. Authorization rules for pages, positions & candidates, and the structural edit window

The earlier sections describe `votes`/`vote_tallies`/`voter_turnout` RLS in
detail; this section makes the rest of the authorization model explicit,
including a new constraint: **positions and candidates can only be inserted
or deleted before an election's voting window opens.**

- **`pages`**: SELECT is public when `is_private = false`, or restricted to
  the owner and to signed-in users whose email domain appears in
  `allowed_domains` when `is_private = true` (via the shared
  `is_domain_allowed(page_id, email)` function from §5). INSERT is open to
  any authenticated user (they become `owner_id`). UPDATE/DELETE are
  owner-only, at any time — editing the title, voting window, or
  privacy/domain settings is not restricted by the rule below, since none of
  those actions can retroactively invalidate a candidate's photo, bio, or a
  cast vote the way adding/removing a candidate can.
- **`allowed_domains`**: owner-only for INSERT/UPDATE/DELETE, at any time,
  following the same reasoning as page settings above.
- **`positions`**: SELECT follows the parent page's visibility rule.
  UPDATE (e.g. renaming a position or changing its order) is owner-only, at
  any time. **INSERT and DELETE are owner-only, and additionally require
  `now() < pages.voting_starts_at`** for that position's page — enforced via
  a `WITH CHECK`/`USING` clause that joins to `pages` on `page_id`.
- **`candidates`**: SELECT follows the parent page's visibility rule (via
  its position's page). UPDATE (editing a candidate's name, bio, or photo)
  is owner-only, at any time. **INSERT and DELETE are owner-only, and
  additionally require `now() < pages.voting_starts_at`** for that
  candidate's page — enforced the same way, joining `candidates →
  positions → pages`.

**Why insert/delete specifically, and only before the window opens:** once
voting has started, removing a candidate would orphan any votes already
cast for them, and adding one would let people vote for an option nobody
else had a chance to consider — either undermines trust in the result.
Editing an existing candidate's bio or photo doesn't have that failure
mode, so it stays unrestricted; deciding whether that's also worth locking
down (for example, to stop a name change mid-vote) is left as a follow-up
question rather than assumed here.

**Enforcement is at the database, not just the UI:** the manager console
hides the "add candidate" and "delete position" affordances once a page's
voting window has opened, purely for a clear user experience — but the
actual protection is the RLS policy itself, so a direct API call attempting
to insert or delete a position/candidate after the window opens is rejected
regardless of what the UI shows.
