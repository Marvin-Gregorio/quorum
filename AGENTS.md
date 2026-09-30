# Voting System — Agent Guide

## Project overview

A self-service, multi-tenant voting platform. Any signed-in user can create an
"election page" (one or more positions, each with its own candidates) and
becomes its manager simply by having created it — there is no separate role
assignment. Voters sign in with Google or Microsoft, vote once per position
(able to change their vote until the window closes), and results are visible
on a live dashboard. Built on Next.js and Supabase (Postgres, Auth, Storage,
Realtime), designed to run entirely within Supabase's free tier.

Full design rationale lives in
[`docs/superpowers/specs/2026-09-28-voting-system-design.md`](docs/superpowers/specs/2026-09-28-voting-system-design.md);
this file distills the rules that must hold regardless of implementation
details.

## Tech stack

- Next.js (App Router, Server Components + Server Actions) — no separate
  backend server.
- Supabase: Postgres, Auth (OAuth only), Storage, Realtime.
- Zod for server-side schema validation.
- `sanitize-html` for stripping free-text input.
- `browser-image-compression` for client-side candidate photo compression.

## Architecture conventions

- **All authorization lives in Postgres RLS, not just the UI.** The UI may
  hide an action for a clean experience, but the actual protection is always
  the RLS policy — a direct API call must be rejected the same way a UI
  action would be.
- **Server Actions are defense-in-depth, never the sole boundary.**
  Client-side trimming/sanitizing is for UX only; server-side Zod validation
  + HTML sanitization is the real boundary before any Supabase write.
- **Realtime is for managers only; the public results page polls.** The
  manager console (and an owner viewing their own results) subscribes to
  Supabase Realtime on rollup tables. Everyone else polls a Route Handler
  every ~5–8s. This keeps Realtime connections bounded to active managers,
  not public viewership, which is the resource with a hard free-tier ceiling.

## Styling & UI conventions

- **Tailwind CSS v4 utility classes only — no hand-written custom CSS
  classes.** Every element is styled with Tailwind classes directly in JSX.
  The only non-utility CSS allowed is in `src/app/globals.css`: a `@theme`
  block declaring design tokens (`--color-paper`, `--color-ink`, etc., using
  the `--color-*` prefix so Tailwind auto-generates matching `bg-*`/`text-*`/
  `border-*` utilities) and a minimal `@layer base` for true page-wide resets
  (box-sizing, body/heading font, the focus-visible ring, reduced-motion) —
  never component-specific styling.
- **Reused class strings live in `src/lib/ui-classes.ts`, not as CSS
  classes.** When the same Tailwind utility string is needed in 2+ files
  (buttons, form inputs, modals, avatars, etc.), export it as a named
  constant (or small function, e.g. `avatarClass(size)`) from that module and
  import it. A string only used in one file can stay inlined there.
- **Compose classes with `cn()` (`src/lib/cn.ts`, clsx + tailwind-merge),
  never by concatenating strings.** Once everything is a plain Tailwind
  utility class, two classes that target the same CSS property (e.g.
  `items-center` and `items-start`) don't resolve by source order — only
  `tailwind-merge` reliably picks the intended one. Use `cn(base, override)`
  for every base-class-plus-conditional-override composition, however small.
- **Avoid inline `style` — it should only appear for a value with no finite
  set of Tailwind classes** (e.g. a computed 0–100% bar width from live vote
  counts). Tailwind's JIT compiler only generates CSS for literal class
  strings it can see in source, so a truly dynamic/continuous value has no
  other option. For a dynamic *image*, render a real `<img>` or `next/image`
  with `src={url}` instead of setting `backgroundImage` via `style` — that
  isn't a styling concern at all once it's just a prop.
- **`next/image` needs every remote host listed in `next.config.ts`'s
  `images.remotePatterns`** (already configured for Supabase Storage:
  `*.supabase.co` in production, `127.0.0.1:54321`/`localhost:54321` for the
  local Supabase CLI, with `dangerouslyAllowLocalIP` scoped to non-production
  since Next's SSRF guard otherwise blocks private-IP fetches). A client-only
  `blob:` object-URL preview (e.g. a photo picked but not yet uploaded) can't
  be optimized server-side — leave those as a plain `<img>` with a one-line
  `eslint-disable-next-line @next/next/no-img-element` explaining why.
- **Tailwind v4 mechanics this codebase relies on** — reach for these instead
  of writing custom CSS: `has-checked:` / `group-has-checked:` for styling
  that depends on a sibling or descendant's `:checked` state (e.g. a
  ballot-row highlighting when its radio is selected); `appearance-none` +
  `checked:` + an arbitrary `shadow-[inset_...]` for custom radio/checkbox
  circles; arbitrary-value brackets use `_` (underscore) not `,` (comma) to
  represent a space, e.g. `grid-cols-[8px_8px]`.
- **Comments: only document a non-obvious "why," never restate the code.**
  A comment earns its place by explaining a hidden constraint, an invariant,
  a workaround for a specific library/DB quirk, or a business rule a reader
  couldn't otherwise infer (this file's own Business rules section is exactly
  that kind of thing) — not by describing what a well-named
  function/variable/class-string already makes obvious.

## Business rules

### Ownership & roles

- Creating a page requires only being authenticated — the creator's user id
  is stored as `owner_id` at creation time. That's the entire mechanism for
  "becoming a manager." There's no separate roles table or permission grant.
- A manager only manages the page(s) they created; there's no ownership over
  any other page.
- **Single-owner only, deliberately** — multiple managers/co-owners per page
  is out of scope for v1, not an oversight. Don't build toward shared
  ownership unless asked.

### Auth & access

- **OAuth only — Google and Microsoft. No password-based accounts, ever.**
- **Voting always requires sign-in, on both public and private pages.** This
  is what makes one-vote-per-person-per-position enforceable at all — it's
  not just a private-page restriction.
- "Public" means any email domain is accepted; "private" means the voter's
  email domain must appear in that page's allowed-domains list.
- **A private page's ballot and results dashboard are gated identically** —
  if someone can't vote, they also can't see results, and vice versa. Don't
  build a path where one is more permissive than the other.
- **Domain gating is enforced twice**: a fast UX-layer check (immediate
  redirect with a clear message) and the authoritative check inside RLS
  policies. The RLS check is the one that actually matters — it can't be
  bypassed by calling Supabase directly, even if the UX-layer check is.

### Voting, secrecy & the structural edit window

- One vote per voter per position, implemented as an upsert — a voter can
  change their choice freely until the voting window closes. Resubmitting is
  not a new vote, it's an update of the same row.
- **Secret ballot: nobody, including the page's manager, can ever read which
  candidate a specific voter chose.** The manager can see turnout (who has
  voted per position) but the individual's choice is never exposed to
  anyone but that voter themselves. Don't add a code path — reporting,
  export, debug view, admin tool — that would expose the voter→candidate
  mapping to anyone other than the voter who cast it.
- Tallies and turnout are separate concerns from the vote itself, maintained
  by a trigger, never written to directly by any client. This is what lets
  turnout be visible to the manager without leaking the choice.
- **Positions and candidates can only be inserted or deleted before an
  election's voting window opens — never after, and never once voting has
  ended.** The reasoning: removing a candidate mid-election would orphan
  votes already cast for them; adding one would let people vote for an
  option nobody else had a chance to consider. Either undermines trust in
  the result.
- **Editing an existing candidate's name/bio/photo stays unrestricted at any
  time** — that doesn't have the same failure mode as insert/delete, since
  no vote is being invalidated or a new option introduced unfairly. Don't
  conflate "editing" with "adding/removing" when reasoning about the edit
  window — they have different rules for a specific reason.
- Editing page-level settings (title, voting window, privacy/domain
  settings) is owner-only but **not** restricted by the edit window — those
  actions don't retroactively invalidate a candidate or a cast vote the way
  adding/removing a candidate does.
- **Enforcement is at the database (RLS), not just the UI.** The manager
  console hides "add candidate"/"delete position" once voting has opened
  purely for UX clarity — the actual protection is the RLS policy itself.

### Input handling & media rules

- Client-side sanitization/validation is for UX (immediate feedback) only —
  **never treat it as the security boundary.**
- The real boundary is server-side: every Server Action validates input with
  a Zod schema (length limits, allowed characters) and strips HTML tags from
  free-text fields before any Supabase insert/update. This exists
  specifically to prevent stored XSS in candidate names/bios that would
  otherwise render on the public candidate list.
- Candidate photos are compressed client-side before upload: downscaled to a
  max bound (~800×800px), re-encoded as WebP, targeting ~150–250KB per
  photo. The compressed file uploads directly from the browser to Supabase
  Storage — never through a Next.js server route (avoids double egress and
  server compute).

## Out of scope (v1) — don't build toward these

- Multiple managers/co-owners per page.
- Automated tie-breaking, ranked-choice, or multi-select voting methods.
- CSV/export of results or turnout data.
- Email/SMS reminders or notifications to non-voters.
- Rate-limiting or bot/abuse detection beyond OAuth-based vote uniqueness.
- Internationalization.
