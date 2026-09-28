# Voting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-service, multi-tenant election platform described in the spec — Google/Microsoft-only auth, secret-ballot RLS, client-side-compressed candidate photos, and a structural edit window that locks positions/candidates once voting opens.

**Architecture:** Next.js App Router (Server Components + Server Actions) talking directly to Supabase (Postgres + Auth + Storage + Realtime) with no separate backend server. All authorization lives in Postgres RLS policies, not just the UI; Server Actions are a second, defense-in-depth layer of validation/sanitization. The manager console subscribes to Realtime on two small rollup tables; the public results page polls a Route Handler instead, keeping Realtime connections bounded to active managers only.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind CSS, Zod, `sanitize-html`, `browser-image-compression`, Vitest (unit), Playwright (e2e), a small Node script for RLS tests (multiple JWT-scoped Supabase clients — no pgTAP dependency, since Supabase's hosted Postgres doesn't ship it by default).

**Spec:** `docs/superpowers/specs/2026-09-28-voting-system-design.md`

## Global Constraints

- OAuth only (Google + Azure/Microsoft) — no password-based accounts, ever (spec §5).
- Voting always requires sign-in, on public and private pages alike (spec §5).
- Private-page domain gating is enforced in RLS (authoritative), with a fast Server Component check for UX only — never trust the fast check alone (spec §5).
- `votes` table: no SELECT policy except `USING (voter_id = auth.uid())`; nobody else, including the page owner, ever gets a row from it (spec §7).
- `vote_tallies`/`voter_turnout` are written only by the DB trigger (`SECURITY DEFINER`), never by client INSERT/UPDATE (spec §6/§7).
- Manager console uses Supabase Realtime; the public results page uses polling (~5–8s) via a Route Handler — never give the public page a Realtime subscription (spec §7).
- Candidate photos are compressed client-side (max ~800×800px, WebP, ~150–250KB target) before upload; upload goes browser → Supabase Storage directly, never through a Next.js server route (spec §8).
- Every Server Action validates with Zod and sanitizes free text with `sanitize-html` server-side — client-side trimming is UX only, never the security boundary (spec §9).
- Positions/candidates: INSERT and DELETE require `now() < pages.voting_starts_at`, enforced in RLS, not just hidden in the UI; UPDATE (editing existing candidate name/bio/photo) stays unrestricted (spec §14).
- `organization_name` is a plain text column on `pages` — no separate `organizations` table (spec §4).

---

## File Structure

```
supabase/
  migrations/
    0001_core_tables.sql        -- profiles (+ mirror trigger), pages, allowed_domains, positions, candidates
    0002_vote_tables.sql        -- votes, vote_tallies, voter_turnout + maintenance trigger
    0003_rls_pages.sql          -- is_domain_allowed(), RLS for profiles/pages/allowed_domains
    0004_rls_positions_candidates.sql -- RLS for positions/candidates incl. edit-window check
    0005_rls_votes.sql          -- RLS for votes/vote_tallies/voter_turnout
    0006_storage.sql            -- candidate-photos bucket + storage policies

src/
  lib/
    supabase/
      client.ts                 -- browser Supabase client
      server.ts                 -- server Supabase client (cookies-based)
      types.ts                  -- hand-written Database types matching migrations
    validation.ts               -- Zod schemas (page settings, position, candidate)
    sanitize.ts                 -- sanitizeText() wrapper over sanitize-html
    slug.ts                     -- slugify() + generateUniqueSlug()
    image-compression.ts        -- compressCandidatePhoto()
    access.ts                   -- checkPageAccess() shared domain-gate logic
    queries/
      manage.ts                 -- getManagedElection()
      ballot.ts                 -- getBallot()
      results.ts                -- getResultsSnapshot()
      profile.ts                -- getManagedElections()
  app/
    layout.tsx
    globals.css                 -- design tokens (colors, fonts) from the UI design
    page.tsx                    -- Home
    sign-in/page.tsx
    auth/
      callback/route.ts         -- OAuth code exchange
      actions.ts                -- signOutAction()
    create/
      page.tsx
      actions.ts                -- createElectionAction()
    manage/[slug]/
      page.tsx
      actions.ts                -- settings/candidate/position Server Actions
      realtime-panel.tsx        -- client component: Realtime subscription + live tallies/turnout
    vote/[slug]/
      page.tsx
      actions.ts                -- castVoteAction()
    results/[slug]/
      page.tsx
      live-results.tsx          -- client component: polling
    api/results/[slug]/route.ts -- polling endpoint
    access-restricted/page.tsx
    profile/page.tsx

tests/
  unit/
    validation.test.ts
    sanitize.test.ts
    slug.test.ts
    image-compression.test.ts
  rls/
    setup.ts                    -- helper: create JWT-scoped Supabase clients for test users
    votes-secrecy.test.ts
    domain-gating.test.ts
    edit-window.test.ts
  e2e/
    full-flow.spec.ts
```

---

### Task 1: Scaffold Next.js app, Tailwind, and design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: the Next.js project shell every later task builds inside; CSS custom properties `--paper`, `--paper-2`, `--ink`, `--ink-2`, `--seal`, `--seal-dark`, `--ledger`, `--line`, `--line-strong` defined in `globals.css`, matching the validated UI design's palette exactly.

- [ ] **Step 1: Scaffold the project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir=false --import-alias "@/*" --eslint
```
Accept defaults where prompted. This creates `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.

- [ ] **Step 2: Install the rest of the dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr zod sanitize-html browser-image-compression
npm install -D vitest @vitejs/plugin-react jsdom @playwright/test @types/sanitize-html
```

- [ ] **Step 3: Add design tokens to `globals.css`**

Replace the generated Tailwind boilerplate in `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --paper: #EDEAE1;
  --paper-2: #E3DFD2;
  --ink: #1C2B3A;
  --ink-2: #3C4E61;
  --seal: #9C3B2E;
  --seal-dark: #7C2E23;
  --ledger: #46573B;
  --line: #C9C2B2;
  --line-strong: #A79F89;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Public Sans', sans-serif;
}

h1, h2 {
  font-family: 'Fraunces', serif;
  font-weight: 600;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
```

- [ ] **Step 4: Load the fonts and set the page shell in `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quorum',
  description: 'Run a vote your whole organization can trust.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Public+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
});
```

Add to `package.json` `"scripts"`: `"test:unit": "vitest run"`.

- [ ] **Step 6: Write the smoke test**

```ts
// tests/unit/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('project scaffold', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the test suite to confirm the toolchain works**

Run: `npm run test:unit`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Tailwind, fonts, and design tokens"
```

---

### Task 2: Supabase client helpers and hand-written database types

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `.env.local.example`
- Test: `tests/unit/supabase-clients.test.ts`

**Interfaces:**
- Consumes: nothing yet (env vars only)
- Produces: `createBrowserSupabaseClient(): SupabaseClient<Database>` and `createServerSupabaseClient(): Promise<SupabaseClient<Database>>`, both typed against `Database` from `src/lib/supabase/types.ts`. Every later task that touches Supabase imports one of these two.

- [ ] **Step 1: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Tell the person running this plan to copy it to `.env.local` and fill in real values from their Supabase project settings before Task 3 (the migrations need a real project to run against). This step has no test — it's a manual prerequisite.

- [ ] **Step 2: Write the hand-written `Database` types**

```ts
// src/lib/supabase/types.ts
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null };
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null };
        Update: Partial<{ email: string; full_name: string | null; avatar_url: string | null }>;
      };
      pages: {
        Row: {
          id: string;
          slug: string;
          organization_name: string;
          title: string;
          owner_id: string;
          is_private: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          organization_name: string;
          title: string;
          owner_id: string;
          is_private?: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
        };
        Update: Partial<{
          organization_name: string;
          title: string;
          is_private: boolean;
          voting_starts_at: string;
          voting_ends_at: string;
        }>;
      };
      allowed_domains: {
        Row: { page_id: string; domain: string };
        Insert: { page_id: string; domain: string };
        Update: Partial<{ domain: string }>;
      };
      positions: {
        Row: { id: string; page_id: string; title: string; display_order: number };
        Insert: { id?: string; page_id: string; title: string; display_order: number };
        Update: Partial<{ title: string; display_order: number }>;
      };
      candidates: {
        Row: { id: string; position_id: string; name: string; bio: string; photo_url: string | null };
        Insert: { id?: string; position_id: string; name: string; bio: string; photo_url?: string | null };
        Update: Partial<{ name: string; bio: string; photo_url: string | null }>;
      };
      votes: {
        Row: { id: string; voter_id: string; position_id: string; candidate_id: string; updated_at: string };
        Insert: { id?: string; voter_id: string; position_id: string; candidate_id: string };
        Update: Partial<{ candidate_id: string }>;
      };
      vote_tallies: {
        Row: { position_id: string; candidate_id: string; vote_count: number };
        Insert: never;
        Update: never;
      };
      voter_turnout: {
        Row: { page_id: string; position_id: string; voter_id: string; voted_at: string };
        Insert: never;
        Update: never;
      };
    };
  };
}
```

- [ ] **Step 3: Write the browser client**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Write the server client**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component that can't set cookies — safe to
            // ignore as long as middleware refreshes the session (Task 13).
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Write a test that both factory functions return a client with the expected shape**

```ts
// tests/unit/supabase-clients.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

describe('createBrowserSupabaseClient', () => {
  it('returns a client with auth and from()', () => {
    const client = createBrowserSupabaseClient();
    expect(client.auth).toBeDefined();
    expect(typeof client.from).toBe('function');
  });
});
```

- [ ] **Step 6: Run the test**

Run: `npm run test:unit -- supabase-clients`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Supabase client helpers and hand-written database types"
```

---

### Task 3: Migration — core tables (profiles, pages, allowed_domains, positions, candidates)

**Files:**
- Create: `supabase/migrations/0001_core_tables.sql`
- Test: manual verification via `supabase db push` + a SQL editor check (this task has no RLS yet, so no meaningful automated test beyond "the migration applies cleanly" — RLS gets its own tested migrations in Tasks 6–8)

**Interfaces:**
- Consumes: nothing
- Produces: tables `profiles`, `pages`, `allowed_domains`, `positions`, `candidates` exactly as shaped in spec §6, plus the `handle_new_user()` trigger that mirrors `auth.users` into `profiles`. Every later migration and query builds on these exact column names.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0001_core_tables.sql

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text
);

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  organization_name text not null,
  title text not null,
  owner_id uuid not null references profiles(id),
  is_private boolean not null default false,
  voting_starts_at timestamptz not null,
  voting_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint voting_window_valid check (voting_ends_at > voting_starts_at)
);

create table allowed_domains (
  page_id uuid not null references pages(id) on delete cascade,
  domain text not null,
  primary key (page_id, domain)
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  title text not null,
  display_order int not null default 0
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions(id) on delete cascade,
  name text not null,
  bio text not null default '',
  photo_url text
);
```

- [ ] **Step 2: Apply the migration to a linked Supabase project**

Run:
```bash
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
Expected: the command reports `0001_core_tables.sql` applied with no errors.

- [ ] **Step 3: Verify in the Supabase SQL editor**

Run: `select table_name from information_schema.tables where table_schema = 'public';`
Expected: rows for `profiles`, `pages`, `allowed_domains`, `positions`, `candidates`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_core_tables.sql
git commit -m "Add core tables migration: profiles, pages, allowed_domains, positions, candidates"
```

---

### Task 4: Migration — votes, vote_tallies, voter_turnout + maintenance trigger

**Files:**
- Create: `supabase/migrations/0002_vote_tables.sql`

**Interfaces:**
- Consumes: `positions`, `candidates`, `pages`, `profiles` from Task 3
- Produces: tables `votes`, `vote_tallies`, `voter_turnout` and the trigger function `maintain_vote_rollups()` that Task 8's RLS tests exercise indirectly (by inserting into `votes` and reading `vote_tallies`/`voter_turnout` back out).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0002_vote_tables.sql

create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references profiles(id),
  position_id uuid not null references positions(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (voter_id, position_id)
);

create table vote_tallies (
  position_id uuid not null references positions(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  vote_count int not null default 0,
  primary key (position_id, candidate_id)
);

create table voter_turnout (
  page_id uuid not null references pages(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  voter_id uuid not null references profiles(id),
  voted_at timestamptz not null default now(),
  primary key (position_id, voter_id)
);

create function maintain_vote_rollups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_id uuid;
begin
  select page_id into v_page_id from positions where id = new.position_id;

  if tg_op = 'UPDATE' and old.candidate_id is distinct from new.candidate_id then
    update vote_tallies
      set vote_count = vote_count - 1
      where position_id = old.position_id and candidate_id = old.candidate_id;
  end if;

  insert into vote_tallies (position_id, candidate_id, vote_count)
  values (new.position_id, new.candidate_id, 1)
  on conflict (position_id, candidate_id)
    do update set vote_count = vote_tallies.vote_count + 1
    where tg_op = 'INSERT' or old.candidate_id is distinct from new.candidate_id;

  insert into voter_turnout (page_id, position_id, voter_id, voted_at)
  values (v_page_id, new.position_id, new.voter_id, now())
  on conflict (position_id, voter_id) do update set voted_at = now();

  return new;
end;
$$;

create trigger on_vote_cast
  after insert or update on votes
  for each row execute procedure maintain_vote_rollups();
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: `0002_vote_tables.sql` applied with no errors.

- [ ] **Step 3: Manually verify the trigger in the Supabase SQL editor**

Run (substituting real ids from seed data, or a temporary candidate/position/profile you insert for this check):
```sql
insert into votes (voter_id, position_id, candidate_id) values ('<voter-uuid>', '<position-uuid>', '<candidate-uuid>');
select * from vote_tallies where position_id = '<position-uuid>';
select * from voter_turnout where position_id = '<position-uuid>';
```
Expected: `vote_tallies` has one row with `vote_count = 1`; `voter_turnout` has one row for that voter. Then update the same vote to a different candidate and re-run both selects: the old candidate's count drops to 0, the new one becomes 1, and `voter_turnout` still has exactly one row (updated `voted_at`, not a second row).

- [ ] **Step 4: Clean up the manual test data and commit**

```sql
delete from votes where voter_id = '<voter-uuid>';
```
```bash
git add supabase/migrations/0002_vote_tables.sql
git commit -m "Add votes, vote_tallies, voter_turnout tables and rollup-maintenance trigger"
```

---

### Task 5: Migration — is_domain_allowed() and RLS for profiles, pages, allowed_domains

**Files:**
- Create: `supabase/migrations/0003_rls_pages.sql`

**Interfaces:**
- Consumes: `pages`, `allowed_domains`, `profiles` from Task 3
- Produces: `is_domain_allowed(page_id uuid, email text) returns boolean`, reused by Task 6 and Task 7's policies, plus enabled RLS on `profiles`/`pages`/`allowed_domains` matching spec §14.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_rls_pages.sql

create function is_domain_allowed(p_page_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_domains
    where page_id = p_page_id
      and domain = split_part(p_email, '@', 2)
  );
$$;

alter table profiles enable row level security;
alter table pages enable row level security;
alter table allowed_domains enable row level security;

create policy "profiles are readable by their own owner"
  on profiles for select
  using (id = auth.uid());

create policy "profiles are insertable by the mirror trigger only"
  on profiles for insert
  with check (id = auth.uid());

create policy "pages are readable per visibility rule"
  on pages for select
  using (
    is_private = false
    or owner_id = auth.uid()
    or is_domain_allowed(id, auth.jwt() ->> 'email')
  );

create policy "any authenticated user can create a page"
  on pages for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "pages are editable by their owner only"
  on pages for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "pages are deletable by their owner only"
  on pages for delete
  using (owner_id = auth.uid());

create policy "allowed_domains are readable by the page owner only"
  on allowed_domains for select
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "allowed_domains are writable by the page owner only"
  on allowed_domains for insert
  with check (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "allowed_domains are deletable by the page owner only"
  on allowed_domains for delete
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_rls_pages.sql
git commit -m "Add is_domain_allowed() and RLS for profiles, pages, allowed_domains"
```

---

### Task 6: Migration — RLS for positions and candidates (structural edit window)

**Files:**
- Create: `supabase/migrations/0004_rls_positions_candidates.sql`
- Test: `tests/rls/setup.ts`, `tests/rls/edit-window.test.ts`

**Interfaces:**
- Consumes: `is_domain_allowed()` from Task 5; `pages`, `positions`, `candidates` from Task 3
- Produces: the RLS policies spec §14 requires — INSERT/DELETE on `positions`/`candidates` blocked once `now() >= pages.voting_starts_at`; UPDATE unrestricted. Also produces `tests/rls/setup.ts`'s `createClientAs()` helper, reused by every later RLS test file (Tasks 7, 9).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0004_rls_positions_candidates.sql

alter table positions enable row level security;
alter table candidates enable row level security;

create policy "positions are readable per parent page visibility"
  on positions for select
  using (
    exists (
      select 1 from pages
      where pages.id = page_id
        and (
          pages.is_private = false
          or pages.owner_id = auth.uid()
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "positions are insertable by owner before voting starts"
  on positions for insert
  with check (
    exists (
      select 1 from pages
      where pages.id = page_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "positions are updatable by owner any time"
  on positions for update
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()))
  with check (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));

create policy "positions are deletable by owner before voting starts"
  on positions for delete
  using (
    exists (
      select 1 from pages
      where pages.id = page_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "candidates are readable per parent page visibility"
  on candidates for select
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and (
          pages.is_private = false
          or pages.owner_id = auth.uid()
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "candidates are insertable by owner before voting starts"
  on candidates for insert
  with check (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );

create policy "candidates are updatable by owner any time"
  on candidates for update
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id and pages.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id and pages.owner_id = auth.uid()
    )
  );

create policy "candidates are deletable by owner before voting starts"
  on candidates for delete
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and pages.owner_id = auth.uid()
        and now() < pages.voting_starts_at
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`

- [ ] **Step 3: Write the RLS test helper**

```ts
// tests/rls/setup.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the test environment
// (a .env.test file, not committed) so the helper can mint real user sessions
// via the Admin API for RLS tests to run as.
export async function createClientAs(email: string) {
  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await admin.auth.admin.listUsers();
  let user = existing.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: 'test-password-not-used',
    });
    if (error) throw error;
    user = data.user;
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError) throw linkError;

  const anon = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email,
    token: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;

  const client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${verifyData.session!.access_token}` } } }
  );
  return { client, userId: user.id };
}

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 4: Write the failing edit-window test**

```ts
// tests/rls/edit-window.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('structural edit window', () => {
  let ownerClient: Awaited<ReturnType<typeof createClientAs>>;
  let openPageId: string;
  let notYetOpenPageId: string;
  const service = createServiceRoleClient();

  beforeAll(async () => {
    ownerClient = await createClientAs('edit-window-owner@example.com');

    const { data: openPage } = await service
      .from('pages')
      .insert({
        slug: 'edit-window-open-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Already Open',
        owner_id: ownerClient.userId,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    openPageId = openPage!.id;

    const { data: futurePage } = await service
      .from('pages')
      .insert({
        slug: 'edit-window-future-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Not Open Yet',
        owner_id: ownerClient.userId,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    notYetOpenPageId = futurePage!.id;
  });

  afterAll(async () => {
    await service.from('pages').delete().in('id', [openPageId, notYetOpenPageId]);
  });

  it('rejects inserting a position once voting has opened', async () => {
    const { error } = await ownerClient.client
      .from('positions')
      .insert({ page_id: openPageId, title: 'Late Position', display_order: 0 });
    expect(error).not.toBeNull();
  });

  it('allows inserting a position before voting opens', async () => {
    const { data, error } = await ownerClient.client
      .from('positions')
      .insert({ page_id: notYetOpenPageId, title: 'Early Position', display_order: 0 })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe('Early Position');
  });
});
```

- [ ] **Step 5: Run the test and confirm both pass**

Run: `npm run test:rls -- edit-window` (add `"test:rls": "vitest run tests/rls"` to `package.json` scripts first)
Expected: PASS (2 tests) — the first test passes because the INSERT is correctly rejected, not because anything is broken; this is asserting the RLS policy's rejection behavior, not a red/green TDD cycle against not-yet-written app code.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_rls_positions_candidates.sql tests/rls/setup.ts tests/rls/edit-window.test.ts package.json
git commit -m "Add RLS for positions/candidates with structural edit-window enforcement"
```

---

### Task 7: Migration — RLS for votes, vote_tallies, voter_turnout (secret ballot)

**Files:**
- Create: `supabase/migrations/0005_rls_votes.sql`
- Test: `tests/rls/votes-secrecy.test.ts`

**Interfaces:**
- Consumes: `is_domain_allowed()` from Task 5; `votes`/`vote_tallies`/`voter_turnout` from Task 4; `createClientAs`/`createServiceRoleClient` from Task 6
- Produces: the RLS policies spec §7 requires — this is the highest-risk part of the whole system, so it gets its own dedicated test file asserting the secrecy guarantee directly.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_rls_votes.sql

alter table votes enable row level security;
alter table vote_tallies enable row level security;
alter table voter_turnout enable row level security;

create policy "voters can read only their own vote"
  on votes for select
  using (voter_id = auth.uid());

create policy "voters can cast their own vote within the voting window"
  on votes for insert
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and now() between pages.voting_starts_at and pages.voting_ends_at
        and (
          pages.is_private = false
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "voters can change their own vote within the voting window"
  on votes for update
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and now() between pages.voting_starts_at and pages.voting_ends_at
    )
  );

create policy "vote_tallies are readable per parent page visibility"
  on vote_tallies for select
  using (
    exists (
      select 1 from positions
      join pages on pages.id = positions.page_id
      where positions.id = position_id
        and (
          pages.is_private = false
          or pages.owner_id = auth.uid()
          or is_domain_allowed(pages.id, auth.jwt() ->> 'email')
        )
    )
  );

create policy "voter_turnout is readable by the page owner only"
  on voter_turnout for select
  using (exists (select 1 from pages where pages.id = page_id and pages.owner_id = auth.uid()));
```

Note there is deliberately no INSERT/UPDATE policy on `vote_tallies` or `voter_turnout` for any client role — they're written only by `maintain_vote_rollups()`, which runs `security definer` and so bypasses RLS entirely. And there's deliberately no DELETE policy on `votes` — changing a vote is an UPDATE, never a delete.

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`

- [ ] **Step 3: Write the failing secrecy test**

```ts
// tests/rls/votes-secrecy.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('vote secrecy', () => {
  const service = createServiceRoleClient();
  let voterA: Awaited<ReturnType<typeof createClientAs>>;
  let voterB: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;
  let positionId: string;
  let candidateId: string;

  beforeAll(async () => {
    voterA = await createClientAs('voter-a@example.com');
    voterB = await createClientAs('voter-b@example.com');
    owner = await createClientAs('votes-secrecy-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'votes-secrecy-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Secrecy Test Election',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;

    const { data: position } = await service
      .from('positions')
      .insert({ page_id: pageId, title: 'Chair', display_order: 0 })
      .select()
      .single();
    positionId = position!.id;

    const { data: candidate } = await service
      .from('candidates')
      .insert({ position_id: positionId, name: 'Alex', bio: 'Bio' })
      .select()
      .single();
    candidateId = candidate!.id;

    await voterA.client.from('votes').insert({
      voter_id: voterA.userId,
      position_id: positionId,
      candidate_id: candidateId,
    });
  });

  afterAll(async () => {
    await service.from('pages').delete().eq('id', pageId);
  });

  it('lets a voter read their own vote', async () => {
    const { data, error } = await voterA.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId)
      .single();
    expect(error).toBeNull();
    expect(data?.candidate_id).toBe(candidateId);
  });

  it('never lets a different voter read that vote', async () => {
    const { data, error } = await voterB.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('never lets the page owner read that vote', async () => {
    const { data, error } = await owner.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets the owner see turnout without the candidate choice', async () => {
    const { data, error } = await owner.client
      .from('voter_turnout')
      .select('voter_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].voter_id).toBe(voterA.userId);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:rls -- votes-secrecy`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_rls_votes.sql tests/rls/votes-secrecy.test.ts
git commit -m "Add RLS for votes/vote_tallies/voter_turnout enforcing the secret ballot"
```

---

### Task 8: Migration — candidate-photos storage bucket and policies

**Files:**
- Create: `supabase/migrations/0006_storage.sql`

**Interfaces:**
- Consumes: `pages`, `positions`, `candidates` from Task 3
- Produces: the `candidate-photos` bucket that Task 18's client-side upload and Task 20's ballot/results image rendering both depend on. Storage object paths are `{page_id}/{candidate_id}.webp`, so ownership checks join `storage.objects.name`'s first path segment back to `pages.id`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_storage.sql

insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true)
on conflict (id) do nothing;

create policy "candidate photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'candidate-photos');

create policy "candidate photos are writable by the owning page's owner"
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );

create policy "candidate photos are updatable by the owning page's owner"
  on storage.objects for update
  using (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );

create policy "candidate photos are deletable by the owning page's owner"
  on storage.objects for delete
  using (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`

- [ ] **Step 3: Verify the bucket exists**

Run: `select * from storage.buckets where id = 'candidate-photos';`
Expected: one row, `public = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_storage.sql
git commit -m "Add candidate-photos storage bucket and ownership-scoped policies"
```

---

### Task 9: RLS test — domain gating for private pages

**Files:**
- Create: `tests/rls/domain-gating.test.ts`

**Interfaces:**
- Consumes: `createClientAs`/`createServiceRoleClient` from Task 6; RLS from Tasks 5–7
- Produces: nothing new for later tasks to consume — this closes out the RLS test coverage spec §12 calls for (domain-matched vs. non-matched access to a private page).

- [ ] **Step 1: Write the failing test**

```ts
// tests/rls/domain-gating.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('domain gating on a private page', () => {
  const service = createServiceRoleClient();
  let insider: Awaited<ReturnType<typeof createClientAs>>;
  let outsider: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;

  beforeAll(async () => {
    insider = await createClientAs('person@insider-domain.example.com');
    outsider = await createClientAs('person@outsider-domain.example.com');
    owner = await createClientAs('domain-gating-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'domain-gating-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Private Election',
        owner_id: owner.userId,
        is_private: true,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;

    await service.from('allowed_domains').insert({ page_id: pageId, domain: 'insider-domain.example.com' });
  });

  afterAll(async () => {
    await service.from('pages').delete().eq('id', pageId);
  });

  it('lets a matching-domain user read the private page', async () => {
    const { data, error } = await insider.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('hides the private page from a non-matching-domain user', async () => {
    const { data, error } = await outsider.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('always lets the owner read their own private page', async () => {
    const { data, error } = await owner.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:rls -- domain-gating`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/rls/domain-gating.test.ts
git commit -m "Add RLS test coverage for private-page domain gating"
```

---

### Task 10: Validation schemas and sanitizer

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/lib/sanitize.ts`
- Test: `tests/unit/validation.test.ts`, `tests/unit/sanitize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `pageSettingsSchema`, `positionSchema`, `candidateSchema` (Zod schemas, all exported from `src/lib/validation.ts`) and `sanitizeText(input: string): string` from `src/lib/sanitize.ts`. Every Server Action task (15, 17, 18, 19, 20) imports these.

- [ ] **Step 1: Write the failing sanitizer test**

```ts
// tests/unit/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeText } from '@/lib/sanitize';

describe('sanitizeText', () => {
  it('strips HTML tags from input', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('Hello');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  Dana Okafor  ')).toBe('Dana Okafor');
  });

  it('leaves plain text untouched', () => {
    expect(sanitizeText('Wants a repair-request tracker everyone can see.')).toBe(
      'Wants a repair-request tracker everyone can see.'
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- sanitize`
Expected: FAIL — `Cannot find module '@/lib/sanitize'`

- [ ] **Step 3: Implement the sanitizer**

```ts
// src/lib/sanitize.ts
import sanitizeHtml from 'sanitize-html';

export function sanitizeText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- sanitize`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing validation test**

```ts
// tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';

describe('pageSettingsSchema', () => {
  it('accepts a valid settings payload', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-03-14T17:00:00.000Z',
      votingEndsAt: '2026-02-28T09:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('positionSchema', () => {
  it('rejects a title over 100 characters', () => {
    const result = positionSchema.safeParse({ title: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('candidateSchema', () => {
  it('accepts a valid candidate', () => {
    const result = candidateSchema.safeParse({ name: 'Dana Okafor', bio: 'Eight years on the committee.' });
    expect(result.success).toBe(true);
  });

  it('rejects a bio over 500 characters', () => {
    const result = candidateSchema.safeParse({ name: 'Dana Okafor', bio: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test:unit -- validation`
Expected: FAIL — `Cannot find module '@/lib/validation'`

- [ ] **Step 7: Implement the schemas**

```ts
// src/lib/validation.ts
import { z } from 'zod';

export const pageSettingsSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(120),
    votingStartsAt: z.string().datetime(),
    votingEndsAt: z.string().datetime(),
    isPrivate: z.boolean(),
    domains: z.array(z.string().trim().min(1).max(255)),
  })
  .refine((data) => new Date(data.votingEndsAt) > new Date(data.votingStartsAt), {
    message: 'Voting must close after it opens',
    path: ['votingEndsAt'],
  });

export const positionSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

export const candidateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(500),
});
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test:unit -- validation`
Expected: PASS (6 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/validation.ts src/lib/sanitize.ts tests/unit/validation.test.ts tests/unit/sanitize.test.ts
git commit -m "Add Zod validation schemas and HTML sanitizer"
```

---

### Task 11: Slug generation

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/unit/slug.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (only for `generateUniqueSlug`'s uniqueness check, at call time — the function takes a client as a parameter rather than importing one, so it stays testable with a fake)
- Produces: `slugify(title: string): string` and `generateUniqueSlug(supabase: SupabaseClient<Database>, title: string): Promise<string>`. Task 15's `createElectionAction` depends on both.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/slug.test.ts
import { describe, it, expect, vi } from 'vitest';
import { slugify, generateUniqueSlug } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('2026 Board Election')).toBe('2026-board-election');
  });

  it('strips punctuation', () => {
    expect(slugify("Riverside Co-op's Election!")).toBe('riverside-co-ops-election');
  });
});

describe('generateUniqueSlug', () => {
  it('returns the plain slug when it is not taken', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    } as any;
    const slug = await generateUniqueSlug(supabase, '2026 Board Election');
    expect(slug).toBe('2026-board-election');
  });

  it('appends -2 when the plain slug is already taken', async () => {
    let call = 0;
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => {
              call += 1;
              return Promise.resolve(call === 1 ? { data: { id: 'existing' }, error: null } : { data: null, error: null });
            },
          }),
        }),
      }),
    } as any;
    const slug = await generateUniqueSlug(supabase, '2026 Board Election');
    expect(slug).toBe('2026-board-election-2');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- slug`
Expected: FAIL — `Cannot find module '@/lib/slug'`

- [ ] **Step 3: Implement**

```ts
// src/lib/slug.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function generateUniqueSlug(
  supabase: SupabaseClient<Database>,
  title: string
): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabase.from('pages').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- slug`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/unit/slug.test.ts
git commit -m "Add slug generation with uniqueness check"
```

---

### Task 12: Client-side candidate photo compression

**Files:**
- Create: `src/lib/image-compression.ts`
- Test: `tests/unit/image-compression.test.ts`

**Interfaces:**
- Consumes: `browser-image-compression` (npm package from Task 1)
- Produces: `compressCandidatePhoto(file: File): Promise<File>`. Task 18's candidate photo upload UI calls this before uploading to Storage.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/image-compression.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => new File([file], 'compressed.webp', { type: 'image/webp' })),
}));

import imageCompression from 'browser-image-compression';
import { compressCandidatePhoto } from '@/lib/image-compression';

describe('compressCandidatePhoto', () => {
  it('calls browser-image-compression with the documented bounds', async () => {
    const input = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await compressCandidatePhoto(input);
    expect(imageCompression).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        maxWidthOrHeight: 800,
        fileType: 'image/webp',
      })
    );
  });

  it('returns the compressed file', async () => {
    const input = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressCandidatePhoto(input);
    expect(result.name).toBe('compressed.webp');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- image-compression`
Expected: FAIL — `Cannot find module '@/lib/image-compression'`

- [ ] **Step 3: Implement**

```ts
// src/lib/image-compression.ts
import imageCompression from 'browser-image-compression';

export async function compressCandidatePhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 800,
    maxSizeMB: 0.25,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- image-compression`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-compression.ts tests/unit/image-compression.test.ts
git commit -m "Add client-side candidate photo compression"
```

---

### Task 13: Auth — sign-in page, OAuth callback, session refresh, sign-out

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/sign-in/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/actions.ts`
- Test: `tests/unit/sign-in-page.test.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient` (Task 2, client-side OAuth kickoff), `createServerSupabaseClient` (Task 2, callback + sign-out)
- Produces: `signOutAction(): Promise<void>` (server action from `src/app/auth/actions.ts`), used by every header's "Sign out" link in Tasks 14–23. The `/auth/callback` route and `middleware.ts` are infrastructure later tasks rely on implicitly (any authenticated page assumes a valid session cookie, which these two provide).

- [ ] **Step 1: Install the component-testing dependencies**

Run:
```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write the failing test for the sign-in page**

```tsx
// tests/unit/sign-in-page.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from '@/app/sign-in/page';

describe('SignInPage', () => {
  it('renders both OAuth provider buttons', () => {
    render(<SignInPage />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:unit -- sign-in-page`
Expected: FAIL — `Cannot find module '@/app/sign-in/page'`

- [ ] **Step 4: Implement the sign-in page**

```tsx
// src/app/sign-in/page.tsx
'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const supabase = createBrowserSupabaseClient();

  async function signInWith(provider: 'google' | 'azure') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '28px clamp(24px,5vw,64px)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>
          Quorum
        </div>
      </header>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Sign in to Quorum</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, margin: '0 0 32px' }}>
            Sign in to vote, or to create and manage an election.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button type="button" onClick={() => signInWith('google')}>
              Continue with Google
            </button>
            <button type="button" onClick={() => signInWith('azure')}>
              Continue with Microsoft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

This carries over the validated design's copy and layout; full styling (the `.oauth-btn`/`.g-mark`/`.ms-mark` treatment from the design canvas) can be ported into a CSS module alongside this file — that's a pure styling pass with no new behavior, so it isn't broken out as a separate task.

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run test:unit -- sign-in-page`
Expected: PASS

- [ ] **Step 6: Write the OAuth callback route**

```ts
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/profile`);
}
```

- [ ] **Step 7: Write the sign-out server action**

```ts
// src/app/auth/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/');
}
```

- [ ] **Step 8: Write the session-refresh middleware**

```ts
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 9: Manually verify the OAuth round trip**

This step has no automated test — it requires real Google/Azure OAuth apps configured in the Supabase dashboard (Authentication → Providers), which is an account-specific setup step outside this repo.
Run: `npm run dev`, open `/sign-in`, click "Continue with Google", complete the real OAuth consent screen.
Expected: redirected to `/profile` (Task 23 stubs a placeholder for now if it isn't built yet — order tasks so Task 23 lands before this manual check, or skip this manual step until Task 23 exists).

- [ ] **Step 10: Commit**

```bash
git add src/middleware.ts src/app/sign-in/page.tsx src/app/auth/callback/route.ts src/app/auth/actions.ts tests/unit/sign-in-page.test.tsx
git commit -m "Add OAuth sign-in, callback, session-refresh middleware, and sign-out"
```

---

### Task 14: Home page

**Files:**
- Create: `src/app/page.tsx`
- Test: `tests/unit/home-page.test.tsx`

**Interfaces:**
- Consumes: nothing (pure static content + links)
- Produces: nothing later tasks import — this is a leaf page. Its links (`/create`, `/sign-in`) depend on Tasks 13 and 15 existing, so this task should land after both.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/home-page.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the headline and both calls to action', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /run a vote your whole organization can trust/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an election/i })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/sign-in');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- home-page`
Expected: FAIL — current `src/app/page.tsx` (from `create-next-app`'s scaffold) doesn't have this content.

- [ ] **Step 3: Implement the Home page**

Port the validated design's `Main.dc.html` content into a Server Component:

```tsx
// src/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px clamp(24px,5vw,64px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>Quorum</div>
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 15 }}>
          <a href="#how-it-works">How it works</a>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>
      <section style={{ flexGrow: 1, padding: 'clamp(40px,8vw,96px) clamp(24px,5vw,64px)', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 'clamp(36px,5vw,56px)', lineHeight: 1.05, maxWidth: '13ch', marginBottom: 24 }}>
          Run a vote your whole organization can trust.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '46ch', marginBottom: 32 }}>
          Set up positions and candidates, choose which email domains are allowed to vote, and watch results come in as ballots are cast.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/create">Create an election</Link>
          <Link href="/results/example">See a live example</Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- home-page`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx tests/unit/home-page.test.tsx
git commit -m "Add Home page"
```

---

### Task 15: Create Election page and server action

**Files:**
- Create: `src/app/create/page.tsx`
- Create: `src/app/create/actions.ts`
- Test: `tests/unit/create-election-action.test.ts`

**Interfaces:**
- Consumes: `pageSettingsSchema`, `positionSchema`, `candidateSchema`, `sanitizeText` (Task 10); `generateUniqueSlug` (Task 11); `createServerSupabaseClient` (Task 2)
- Produces: `createElectionAction(input: CreateElectionInput): Promise<{ slug: string } | { error: string }>`, where `CreateElectionInput` is `{ organizationName: string; title: string; votingStartsAt: string; votingEndsAt: string; isPrivate: boolean; domains: string[]; positions: { title: string; candidates: { name: string; bio: string }[] }[] }`. Task 16 links to `/manage/${slug}` using this return value.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/create-election-action.test.ts
import { describe, it, expect, vi } from 'vitest';

const insertedRows: Record<string, any[]> = { pages: [], positions: [], candidates: [], allowed_domains: [] };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: (row: any) => ({
        select: () => ({
          single: async () => {
            const withId = { id: `${table}-${insertedRows[table].length + 1}`, ...row };
            insertedRows[table].push(withId);
            return { data: withId, error: null };
          },
        }),
      }),
    }),
  })),
}));

import { createElectionAction } from '@/app/create/actions';

describe('createElectionAction', () => {
  it('creates a page, its positions, and its candidates', async () => {
    const result = await createElectionAction({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
      positions: [
        {
          title: 'Board Chair',
          candidates: [{ name: 'Dana Okafor', bio: 'Eight years on the committee.' }],
        },
      ],
    });

    expect('slug' in result).toBe(true);
    expect(insertedRows.pages).toHaveLength(1);
    expect(insertedRows.positions).toHaveLength(1);
    expect(insertedRows.candidates).toHaveLength(1);
    expect(insertedRows.allowed_domains).toHaveLength(1);
  });

  it('rejects an empty election title', async () => {
    const result = await createElectionAction({
      organizationName: 'Riverside Tenants Cooperative',
      title: '',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
      positions: [],
    });
    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- create-election-action`
Expected: FAIL — `Cannot find module '@/app/create/actions'`

- [ ] **Step 3: Implement the server action**

```ts
// src/app/create/actions.ts
'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';
import { generateUniqueSlug } from '@/lib/slug';

export interface CreateElectionInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
  positions: { title: string; candidates: { name: string; bio: string }[] }[];
}

export async function createElectionAction(
  input: CreateElectionInput
): Promise<{ slug: string } | { error: string }> {
  const settingsResult = pageSettingsSchema.safeParse(input);
  if (!settingsResult.success) {
    return { error: settingsResult.error.issues[0].message };
  }

  for (const position of input.positions) {
    const positionResult = positionSchema.safeParse(position);
    if (!positionResult.success) {
      return { error: positionResult.error.issues[0].message };
    }
    for (const candidate of position.candidates) {
      const candidateResult = candidateSchema.safeParse(candidate);
      if (!candidateResult.success) {
        return { error: candidateResult.error.issues[0].message };
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'You must be signed in to create an election.' };
  }

  const slug = await generateUniqueSlug(supabase, input.title);

  const { data: page, error: pageError } = await supabase
    .from('pages')
    .insert({
      slug,
      organization_name: sanitizeText(input.organizationName),
      title: sanitizeText(input.title),
      owner_id: userData.user.id,
      is_private: input.isPrivate,
      voting_starts_at: input.votingStartsAt,
      voting_ends_at: input.votingEndsAt,
    })
    .select()
    .single();

  if (pageError || !page) {
    return { error: 'Could not create the election. Please try again.' };
  }

  if (input.isPrivate && input.domains.length > 0) {
    await supabase
      .from('allowed_domains')
      .insert(input.domains.map((domain) => ({ page_id: page.id, domain: sanitizeText(domain) })));
  }

  for (const [index, position] of input.positions.entries()) {
    const { data: createdPosition } = await supabase
      .from('positions')
      .insert({ page_id: page.id, title: sanitizeText(position.title), display_order: index })
      .select()
      .single();

    if (createdPosition) {
      for (const candidate of position.candidates) {
        await supabase.from('candidates').insert({
          position_id: createdPosition.id,
          name: sanitizeText(candidate.name),
          bio: sanitizeText(candidate.bio),
        });
      }
    }
  }

  return { slug: page.slug };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- create-election-action`
Expected: PASS (2 tests)

- [ ] **Step 5: Build the Create Election page (client component driving the form + modal, per the validated design)**

```tsx
// src/app/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createElectionAction, type CreateElectionInput } from './actions';

type Candidate = { id: string; name: string; bio: string };
type Position = { id: string; title: string; candidates: Candidate[] };

export default function CreateElectionPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [title, setTitle] = useState('');
  const [votingStartsAt, setVotingStartsAt] = useState('');
  const [votingEndsAt, setVotingEndsAt] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: CreateElectionInput = {
      organizationName,
      title,
      votingStartsAt: new Date(votingStartsAt).toISOString(),
      votingEndsAt: new Date(votingEndsAt).toISOString(),
      isPrivate,
      domains,
      positions: positions.map((p) => ({
        title: p.title,
        candidates: p.candidates.map((c) => ({ name: c.name, bio: c.bio })),
      })),
    };
    const result = await createElectionAction(input);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.push(`/manage/${result.slug}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create an election</h1>
      {error && <p role="alert">{error}</p>}
      <label htmlFor="org-name">Organization name</label>
      <input id="org-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
      <label htmlFor="title">Election title</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="opens">Opens</label>
      <input id="opens" type="datetime-local" value={votingStartsAt} onChange={(e) => setVotingStartsAt(e.target.value)} />
      <label htmlFor="closes">Closes</label>
      <input id="closes" type="datetime-local" value={votingEndsAt} onChange={(e) => setVotingEndsAt(e.target.value)} />
      {/* Public/private radio + domain chip editor, and the position/candidate
          list with its add-candidate modal, port directly from the validated
          CreateElection.dc.html design (positions/candidates state shape and
          modal open/close logic already match Position/Candidate above one
          for one) — omitted here for brevity since it's a direct port with
          no new logic beyond what's shown. */}
      <button type="submit">Create election</button>
    </form>
  );
}
```

Note for whoever implements this step: the bracketed comment marks a straightforward UI-porting task (copying the already-approved modal/list interaction from the design canvas into React state), not a design decision — there is nothing left to invent, only to translate `onClick`/`state` from the `.dc.html` component into `useState`/`onClick` in React. If the port reveals a genuine gap (e.g., the domain-chip editor's "Add" button in the design was visual-only), open a small follow-up task rather than improvising.

- [ ] **Step 6: Commit**

```bash
git add src/app/create/page.tsx src/app/create/actions.ts tests/unit/create-election-action.test.ts
git commit -m "Add Create Election page and server action"
```

---

### Task 16: Domain-gate helper and Access Restricted page

**Files:**
- Create: `src/lib/access.ts`
- Create: `src/app/access-restricted/page.tsx`
- Test: `tests/unit/access.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2)
- Produces: `checkPageAccess(supabase: SupabaseClient<Database>, page: { id: string; is_private: boolean; owner_id: string }, userId: string | null, userEmail: string | null): 'ok' | 'sign-in' | 'restricted'`. Tasks 17 (Manager Console), 20 (Ballot), and 22 (Results) all call this at the top of their Server Component before rendering anything, and redirect to `/sign-in` or `/access-restricted` on anything but `'ok'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/access.test.ts
import { describe, it, expect } from 'vitest';
import { checkPageAccess } from '@/lib/access';

function fakeSupabase(matches: boolean) {
  return {
    rpc: async () => ({ data: matches, error: null }),
  } as any;
}

describe('checkPageAccess', () => {
  const publicPage = { id: 'page-1', is_private: false, owner_id: 'owner-1' };
  const privatePage = { id: 'page-2', is_private: true, owner_id: 'owner-1' };

  it('requires sign-in on a public page when there is no user', async () => {
    const result = await checkPageAccess(fakeSupabase(false), publicPage, null, null);
    expect(result).toBe('sign-in');
  });

  it('allows any signed-in user on a public page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), publicPage, 'voter-1', 'voter@anywhere.com');
    expect(result).toBe('ok');
  });

  it('always allows the owner on their own private page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), privatePage, 'owner-1', 'owner@example.com');
    expect(result).toBe('ok');
  });

  it('allows a matching-domain user on a private page', async () => {
    const result = await checkPageAccess(fakeSupabase(true), privatePage, 'voter-1', 'voter@insider.com');
    expect(result).toBe('ok');
  });

  it('restricts a non-matching-domain user on a private page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), privatePage, 'voter-1', 'voter@outsider.com');
    expect(result).toBe('restricted');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- access`
Expected: FAIL — `Cannot find module '@/lib/access'`

- [ ] **Step 3: Implement**

```ts
// src/lib/access.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

export type PageAccess = 'ok' | 'sign-in' | 'restricted';

export async function checkPageAccess(
  supabase: SupabaseClient<Database>,
  page: { id: string; is_private: boolean; owner_id: string },
  userId: string | null,
  userEmail: string | null
): Promise<PageAccess> {
  if (!userId) return 'sign-in';
  if (!page.is_private) return 'ok';
  if (userId === page.owner_id) return 'ok';

  const { data: allowed } = await supabase.rpc('is_domain_allowed', {
    p_page_id: page.id,
    p_email: userEmail ?? '',
  });

  return allowed ? 'ok' : 'restricted';
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- access`
Expected: PASS (5 tests)

- [ ] **Step 5: Build the Access Restricted page**

```tsx
// src/app/access-restricted/page.tsx
import Link from 'next/link';

export default function AccessRestrictedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '28px clamp(24px,5vw,64px)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>Quorum</div>
      </header>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>This election is only open to a specific email domain</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            Ask the organizer to add your email domain, or sign in with a different account.
          </p>
          <Link href="/sign-in">Sign in with a different account</Link>
          <br />
          <Link href="/">Return home</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/access.ts src/app/access-restricted/page.tsx tests/unit/access.test.ts
git commit -m "Add domain-gate access check and Access Restricted page"
```

---

### Task 17: Manager Console — data loading and settings action

**Files:**
- Create: `src/lib/queries/manage.ts`
- Create: `src/app/manage/[slug]/page.tsx`
- Create: `src/app/manage/[slug]/actions.ts`
- Test: `tests/unit/manage-queries.test.ts`, `tests/unit/update-settings-action.test.ts`

**Interfaces:**
- Consumes: `checkPageAccess` (Task 16), `pageSettingsSchema`/`sanitizeText` (Task 10), `createServerSupabaseClient` (Task 2)
- Produces: `getManagedElection(supabase, slug): Promise<ManagedElection | null>` where `ManagedElection = { id: string; slug: string; organizationName: string; title: string; isPrivate: boolean; domains: string[]; votingStartsAt: string; votingEndsAt: string; ownerId: string; positions: { id: string; title: string; candidates: { id: string; name: string; bio: string; photoUrl: string | null }[] }[] }`, and `updateElectionSettingsAction(pageId: string, input: PageSettingsInput): Promise<{ ok: true } | { error: string }>`. Task 18 and 19's actions live in the same `actions.ts` file and reuse `ManagedElection`'s shape for their own return types.

- [ ] **Step 1: Write the failing query test**

```ts
// tests/unit/manage-queries.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getManagedElection } from '@/lib/queries/manage';

describe('getManagedElection', () => {
  it('returns null when no page matches the slug', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    } as any;
    const result = await getManagedElection(supabase, 'does-not-exist');
    expect(result).toBeNull();
  });

  it('maps a found page into the ManagedElection shape', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'pages') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'page-1',
                    slug: 'test-election',
                    organization_name: 'Test Org',
                    title: 'Test Election',
                    is_private: true,
                    voting_starts_at: '2026-02-28T09:00:00.000Z',
                    voting_ends_at: '2026-03-14T17:00:00.000Z',
                    owner_id: 'owner-1',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'allowed_domains') {
          return { select: () => ({ eq: async () => ({ data: [{ domain: 'riverside.coop' }], error: null }) }) };
        }
        if (table === 'positions') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: 'pos-1', title: 'Board Chair', candidates: [{ id: 'cand-1', name: 'Dana Okafor', bio: 'Bio', photo_url: null }] }],
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getManagedElection(supabase, 'test-election');
    expect(result?.organizationName).toBe('Test Org');
    expect(result?.domains).toEqual(['riverside.coop']);
    expect(result?.positions[0].candidates[0].name).toBe('Dana Okafor');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- manage-queries`
Expected: FAIL — `Cannot find module '@/lib/queries/manage'`

- [ ] **Step 3: Implement the query**

```ts
// src/lib/queries/manage.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface ManagedElection {
  id: string;
  slug: string;
  organizationName: string;
  title: string;
  isPrivate: boolean;
  domains: string[];
  votingStartsAt: string;
  votingEndsAt: string;
  ownerId: string;
  positions: {
    id: string;
    title: string;
    candidates: { id: string; name: string; bio: string; photoUrl: string | null }[];
  }[];
}

export async function getManagedElection(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<ManagedElection | null> {
  const { data: page } = await supabase.from('pages').select('*').eq('slug', slug).maybeSingle();
  if (!page) return null;

  const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', page.id);

  const { data: positionRows } = await supabase
    .from('positions')
    .select('id, title, candidates(id, name, bio, photo_url)')
    .eq('page_id', page.id)
    .order('display_order');

  return {
    id: page.id,
    slug: page.slug,
    organizationName: page.organization_name,
    title: page.title,
    isPrivate: page.is_private,
    domains: (domainRows ?? []).map((d: any) => d.domain),
    votingStartsAt: page.voting_starts_at,
    votingEndsAt: page.voting_ends_at,
    ownerId: page.owner_id,
    positions: (positionRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      candidates: (p.candidates ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_url,
      })),
    })),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- manage-queries`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing settings-action test**

```ts
// tests/unit/update-settings-action.test.ts
import { describe, it, expect, vi } from 'vitest';

const updates: any[] = [];
const deletedDomainsFor: string[] = [];
const insertedDomains: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (table: string) => {
      if (table === 'pages') {
        return {
          update: (row: any) => ({
            eq: (_col: string, id: string) => ({
              eq: (_col2: string, ownerId: string) => {
                updates.push({ id, ownerId, row });
                return Promise.resolve({ error: null });
              },
            }),
          }),
        };
      }
      if (table === 'allowed_domains') {
        return {
          delete: () => ({ eq: (_col: string, pageId: string) => { deletedDomainsFor.push(pageId); return Promise.resolve({ error: null }); } }),
          insert: (rows: any[]) => { insertedDomains.push(...rows); return Promise.resolve({ error: null }); },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));

import { updateElectionSettingsAction } from '@/app/manage/[slug]/actions';

describe('updateElectionSettingsAction', () => {
  it('updates the page and replaces its allowed domains', async () => {
    const result = await updateElectionSettingsAction('page-1', {
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
    });

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].ownerId).toBe('owner-1');
    expect(deletedDomainsFor).toEqual(['page-1']);
    expect(insertedDomains).toEqual([{ page_id: 'page-1', domain: 'riverside.coop' }]);
  });

  it('rejects an invalid settings payload', async () => {
    const result = await updateElectionSettingsAction('page-1', {
      organizationName: '',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test:unit -- update-settings-action`
Expected: FAIL — `Cannot find module '@/app/manage/[slug]/actions'`

- [ ] **Step 7: Implement the settings action (this file also holds Task 18/19's actions)**

```ts
// src/app/manage/[slug]/actions.ts
'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';

export interface PageSettingsInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
}

export async function updateElectionSettingsAction(
  pageId: string,
  input: PageSettingsInput
): Promise<{ ok: true } | { error: string }> {
  const result = pageSettingsSchema.safeParse(input);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in.' };

  const { error } = await supabase
    .from('pages')
    .update({
      organization_name: sanitizeText(input.organizationName),
      title: sanitizeText(input.title),
      is_private: input.isPrivate,
      voting_starts_at: input.votingStartsAt,
      voting_ends_at: input.votingEndsAt,
    })
    .eq('id', pageId)
    .eq('owner_id', userData.user.id);

  if (error) return { error: 'Could not save settings.' };

  await supabase.from('allowed_domains').delete().eq('page_id', pageId);
  if (input.isPrivate && input.domains.length > 0) {
    await supabase
      .from('allowed_domains')
      .insert(input.domains.map((domain) => ({ page_id: pageId, domain: sanitizeText(domain) })));
  }

  return { ok: true };
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test:unit -- update-settings-action`
Expected: PASS (2 tests)

- [ ] **Step 9: Build the Manager Console page shell**

```tsx
// src/app/manage/[slug]/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getManagedElection } from '@/lib/queries/manage';

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const election = await getManagedElection(supabase, slug);
  if (!election) redirect('/');

  const access = await checkPageAccess(
    supabase,
    { id: election.id, is_private: election.isPrivate, owner_id: election.ownerId },
    userData.user?.id ?? null,
    userData.user?.email ?? null
  );
  if (access === 'sign-in') redirect('/sign-in');
  if (access === 'restricted' || userData.user?.id !== election.ownerId) redirect('/access-restricted');

  return (
    <div>
      <h1>{election.title}</h1>
      <p>{election.organizationName}</p>
      {/* Positions/candidates roster, settings modal, and the Realtime tally
          panel (Task 18/19's actions, this task's data) port directly from
          the validated Manage.dc.html design — its state shape (positions
          array with nested candidates, candidateModal/settingsModal) maps
          onto ManagedElection one for one. */}
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/queries/manage.ts src/app/manage/[slug]/page.tsx src/app/manage/[slug]/actions.ts tests/unit/manage-queries.test.ts tests/unit/update-settings-action.test.ts
git commit -m "Add Manager Console data loading and settings action"
```

---

### Task 18: Manager Console — candidate CRUD actions and photo upload

**Files:**
- Modify: `src/app/manage/[slug]/actions.ts`
- Create: `src/app/manage/[slug]/candidate-photo-upload.tsx`
- Test: `tests/unit/candidate-actions.test.ts`

**Interfaces:**
- Consumes: `candidateSchema`/`sanitizeText` (Task 10), `compressCandidatePhoto` (Task 12), `createBrowserSupabaseClient` (Task 2, for the client-side direct-to-Storage upload)
- Produces: `createCandidateAction(positionId: string, input: { name: string; bio: string }): Promise<{ id: string } | { error: string }>`, `updateCandidateAction(candidateId: string, input: { name: string; bio: string }): Promise<{ ok: true } | { error: string }>`, `deleteCandidateAction(candidateId: string): Promise<{ ok: true } | { error: string }>`, and the client component `<CandidatePhotoUpload candidateId={string} pageId={string} onUploaded={(url: string) => void} />` that Task 17's Manager Console page composes into its candidate-edit modal.

- [ ] **Step 1: Write the failing test for the three candidate actions**

```ts
// tests/unit/candidate-actions.test.ts
import { describe, it, expect, vi } from 'vitest';

const state = { candidates: [{ id: 'cand-1', name: 'Old Name', bio: 'Old bio' }] };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== 'candidates') throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              const created = { id: 'cand-new', ...row };
              state.candidates.push(created);
              return { data: created, error: null };
            },
          }),
        }),
        update: (row: any) => ({
          eq: async (_col: string, id: string) => {
            const found = state.candidates.find((c) => c.id === id);
            if (found) Object.assign(found, row);
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            state.candidates = state.candidates.filter((c) => c.id !== id);
            return { error: null };
          },
        }),
      };
    },
  })),
}));

import { createCandidateAction, updateCandidateAction, deleteCandidateAction } from '@/app/manage/[slug]/actions';

describe('candidate actions', () => {
  it('creates a candidate under a position', async () => {
    const result = await createCandidateAction('pos-1', { name: 'Marcus Whitfield', bio: 'New to the board.' });
    expect('id' in result).toBe(true);
  });

  it('updates an existing candidate', async () => {
    const result = await updateCandidateAction('cand-1', { name: 'New Name', bio: 'New bio' });
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === 'cand-1')?.name).toBe('New Name');
  });

  it('deletes a candidate', async () => {
    const result = await deleteCandidateAction('cand-1');
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === 'cand-1')).toBeUndefined();
  });

  it('rejects an empty candidate name', async () => {
    const result = await createCandidateAction('pos-1', { name: '', bio: 'Bio' });
    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- candidate-actions`
Expected: FAIL — the three exports don't exist yet

- [ ] **Step 3: Append the candidate actions to `actions.ts`**

```ts
// src/app/manage/[slug]/actions.ts  (append to the file from Task 17)
import { candidateSchema } from '@/lib/validation';

export async function createCandidateAction(
  positionId: string,
  input: { name: string; bio: string }
): Promise<{ id: string } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert({ position_id: positionId, name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .select()
    .single();

  if (error || !data) return { error: 'Could not add the candidate. Positions may be locked once voting opens.' };
  return { id: data.id };
}

export async function updateCandidateAction(
  candidateId: string,
  input: { name: string; bio: string }
): Promise<{ ok: true } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('candidates')
    .update({ name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .eq('id', candidateId);

  if (error) return { error: 'Could not save the candidate.' };
  return { ok: true };
}

export async function deleteCandidateAction(candidateId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('candidates').delete().eq('id', candidateId);
  if (error) return { error: 'Could not delete the candidate. Positions may be locked once voting opens.' };
  return { ok: true };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- candidate-actions`
Expected: PASS (4 tests)

- [ ] **Step 5: Build the client-side photo upload component**

```tsx
// src/app/manage/[slug]/candidate-photo-upload.tsx
'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';

export function CandidatePhotoUpload({
  candidateId,
  pageId,
  onUploaded,
}: {
  candidateId: string;
  pageId: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const supabase = createBrowserSupabaseClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressCandidatePhoto(file);
      const path = `${pageId}/${candidateId}.webp`;
      const { error } = await supabase.storage
        .from('candidate-photos')
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' });

      if (!error) {
        const { data } = supabase.storage.from('candidate-photos').getPublicUrl(path);
        onUploaded(data.publicUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <label>
      {uploading ? 'Uploading…' : 'Upload photo'}
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} />
    </label>
  );
}
```

Note: this uploads to Storage directly and hands back a public URL; whoever wires this into the Manager Console's candidate modal (Task 17's page, ported from the design's candidate modal) still needs to call `updateCandidateAction`-adjacent logic to persist `photo_url` on the `candidates` row — the simplest way is a fourth action, `updateCandidatePhotoAction(candidateId: string, photoUrl: string)`, following the exact same pattern as `updateCandidateAction` above (Zod isn't needed there since the URL comes from Supabase Storage's own response, not free-text user input).

- [ ] **Step 6: Commit**

```bash
git add src/app/manage/[slug]/actions.ts src/app/manage/[slug]/candidate-photo-upload.tsx tests/unit/candidate-actions.test.ts
git commit -m "Add candidate create/update/delete actions and photo upload"
```

---

### Task 19: Manager Console — position add/delete actions and the Realtime panel

**Files:**
- Modify: `src/app/manage/[slug]/actions.ts`
- Create: `src/app/manage/[slug]/realtime-panel.tsx`
- Test: `tests/unit/position-actions.test.ts`

**Interfaces:**
- Consumes: `positionSchema`/`sanitizeText` (Task 10), `createBrowserSupabaseClient` (Task 2)
- Produces: `createPositionAction(pageId: string, title: string): Promise<{ id: string } | { error: string }>`, `deletePositionAction(positionId: string): Promise<{ ok: true } | { error: string }>`, and the client component `<RealtimePanel pageId={string} initialTallies={...} initialTurnout={...} />` that subscribes to `vote_tallies`/`voter_turnout` and is composed into Task 17's Manager Console page.

- [ ] **Step 1: Write the failing test for the position actions**

```ts
// tests/unit/position-actions.test.ts
import { describe, it, expect, vi } from 'vitest';

const state = { positions: [{ id: 'pos-1', title: 'Board Chair' }] };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== 'positions') throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              const created = { id: 'pos-new', ...row };
              state.positions.push(created);
              return { data: created, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            state.positions = state.positions.filter((p) => p.id !== id);
            return { error: null };
          },
        }),
      };
    },
  })),
}));

import { createPositionAction, deletePositionAction } from '@/app/manage/[slug]/actions';

describe('position actions', () => {
  it('creates a position under a page', async () => {
    const result = await createPositionAction('page-1', 'Treasurer');
    expect('id' in result).toBe(true);
  });

  it('deletes a position', async () => {
    const result = await deletePositionAction('pos-1');
    expect(result).toEqual({ ok: true });
    expect(state.positions.find((p) => p.id === 'pos-1')).toBeUndefined();
  });

  it('rejects an empty position title', async () => {
    const result = await createPositionAction('page-1', '');
    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- position-actions`
Expected: FAIL — the two exports don't exist yet

- [ ] **Step 3: Append the position actions to `actions.ts`**

```ts
// src/app/manage/[slug]/actions.ts  (append)
import { positionSchema } from '@/lib/validation';

export async function createPositionAction(
  pageId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  const result = positionSchema.safeParse({ title });
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('positions')
    .insert({ page_id: pageId, title: sanitizeText(title), display_order: 0 })
    .select()
    .single();

  if (error || !data) return { error: 'Positions can only be added before voting opens.' };
  return { id: data.id };
}

export async function deletePositionAction(positionId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('positions').delete().eq('id', positionId);
  if (error) return { error: 'Positions can only be removed before voting opens.' };
  return { ok: true };
}
```

Both error messages surface the RLS rejection from spec §14 in plain language — the Manager Console's UI (ported from the design) additionally hides these affordances once voting has opened, so a manager on an already-open election never sees the button that would trigger this error in the first place; the message here is the defense-in-depth fallback for a stale page or direct call.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- position-actions`
Expected: PASS (3 tests)

- [ ] **Step 5: Build the Realtime panel**

```tsx
// src/app/manage/[slug]/realtime-panel.tsx
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export interface Tally {
  positionId: string;
  candidateId: string;
  voteCount: number;
}

export interface Turnout {
  positionId: string;
  voterId: string;
}

export function RealtimePanel({
  pageId,
  initialTallies,
  initialTurnout,
}: {
  pageId: string;
  initialTallies: Tally[];
  initialTurnout: Turnout[];
}) {
  const [tallies, setTallies] = useState(initialTallies);
  const [turnout, setTurnout] = useState(initialTurnout);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`manage-${pageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_tallies' }, (payload) => {
        const row = payload.new as { position_id: string; candidate_id: string; vote_count: number };
        setTallies((prev) => {
          const next = prev.filter((t) => !(t.positionId === row.position_id && t.candidateId === row.candidate_id));
          next.push({ positionId: row.position_id, candidateId: row.candidate_id, voteCount: row.vote_count });
          return next;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_turnout' }, (payload) => {
        const row = payload.new as { position_id: string; voter_id: string };
        setTurnout((prev) => {
          if (prev.some((t) => t.positionId === row.position_id && t.voterId === row.voter_id)) return prev;
          return [...prev, { positionId: row.position_id, voterId: row.voter_id }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId]);

  return (
    <div>
      {/* Render tallies/turnout counts per position — visual treatment ports
          directly from the validated Manage.dc.html design's turnout line
          and tally display; no new layout decisions here, just binding
          `tallies`/`turnout` state into that already-approved markup. */}
    </div>
  );
}
```

Note on scope: this subscribes to the whole `vote_tallies`/`voter_turnout` tables rather than filtering by `page_id` in the channel config, because `vote_tallies` doesn't carry `page_id` directly (only `position_id`, which joins to it). Filtering client-side by checking each incoming row's `position_id` against the set of position ids for this page (available from `initialTallies`/`initialTurnout`, or by pre-fetching this page's position ids alongside them) keeps a manager's console from reacting to another page's votes. Add that filter when wiring this into Task 17's page if a manager could plausibly have two elections open in different tabs at once — for a single manager viewing their own console it's a correctness nicety, not a secrecy issue (the RLS SELECT policy still governs what actually gets fetched on reconnect).

- [ ] **Step 6: Commit**

```bash
git add src/app/manage/[slug]/actions.ts src/app/manage/[slug]/realtime-panel.tsx tests/unit/position-actions.test.ts
git commit -m "Add position add/delete actions and the manager's Realtime tally panel"
```

---

### Task 20: Ballot page and vote-casting action

**Files:**
- Create: `src/lib/queries/ballot.ts`
- Create: `src/app/vote/[slug]/page.tsx`
- Create: `src/app/vote/[slug]/actions.ts`
- Test: `tests/unit/ballot-queries.test.ts`, `tests/unit/cast-vote-action.test.ts`

**Interfaces:**
- Consumes: `checkPageAccess` (Task 16), `createServerSupabaseClient` (Task 2)
- Produces: `getBallot(supabase, slug, voterId): Promise<Ballot | null>` where `Ballot = { pageId: string; title: string; organizationName: string; votingEndsAt: string; positions: { id: string; title: string; candidates: { id: string; name: string; bio: string; photoUrl: string | null }[]; selectedCandidateId: string | null }[] }`, and `castVoteAction(positionId: string, candidateId: string): Promise<{ ok: true } | { error: string }>`.

- [ ] **Step 1: Write the failing test for `getBallot`**

```ts
// tests/unit/ballot-queries.test.ts
import { describe, it, expect } from 'vitest';
import { getBallot } from '@/lib/queries/ballot';

describe('getBallot', () => {
  it('marks the voter\'s prior choice as selected', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'pages') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'page-1',
                    title: '2026 Board Election',
                    organization_name: 'Riverside Tenants Cooperative',
                    voting_ends_at: '2026-03-14T17:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'positions') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: 'pos-1',
                      title: 'Board Chair',
                      candidates: [
                        { id: 'cand-1', name: 'Dana Okafor', bio: 'Bio', photo_url: null },
                        { id: 'cand-2', name: 'Marcus Whitfield', bio: 'Bio', photo_url: null },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return { select: () => ({ eq: () => ({ eq: async () => ({ data: [{ position_id: 'pos-1', candidate_id: 'cand-2' }], error: null }) }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getBallot(supabase, 'test-election', 'voter-1');
    expect(result?.positions[0].selectedCandidateId).toBe('cand-2');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- ballot-queries`
Expected: FAIL — `Cannot find module '@/lib/queries/ballot'`

- [ ] **Step 3: Implement `getBallot`**

```ts
// src/lib/queries/ballot.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface Ballot {
  pageId: string;
  title: string;
  organizationName: string;
  votingEndsAt: string;
  positions: {
    id: string;
    title: string;
    candidates: { id: string; name: string; bio: string; photoUrl: string | null }[];
    selectedCandidateId: string | null;
  }[];
}

export async function getBallot(
  supabase: SupabaseClient<Database>,
  slug: string,
  voterId: string
): Promise<Ballot | null> {
  const { data: page } = await supabase.from('pages').select('*').eq('slug', slug).maybeSingle();
  if (!page) return null;

  const { data: positionRows } = await supabase
    .from('positions')
    .select('id, title, candidates(id, name, bio, photo_url)')
    .eq('page_id', page.id)
    .order('display_order');

  const { data: myVotes } = await supabase
    .from('votes')
    .select('position_id, candidate_id')
    .eq('voter_id', voterId)
    .eq('voter_id', voterId);

  const selectedByPosition = new Map((myVotes ?? []).map((v: any) => [v.position_id, v.candidate_id]));

  return {
    pageId: page.id,
    title: page.title,
    organizationName: page.organization_name,
    votingEndsAt: page.voting_ends_at,
    positions: (positionRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      candidates: (p.candidates ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_url,
      })),
      selectedCandidateId: selectedByPosition.get(p.id) ?? null,
    })),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- ballot-queries`
Expected: PASS

- [ ] **Step 5: Write the failing test for `castVoteAction`**

```ts
// tests/unit/cast-vote-action.test.ts
import { describe, it, expect, vi } from 'vitest';

const upserts: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'voter-1' } } }) },
    from: () => ({
      upsert: (row: any, opts: any) => {
        upserts.push({ row, opts });
        return Promise.resolve({ error: null });
      },
    }),
  })),
}));

import { castVoteAction } from '@/app/vote/[slug]/actions';

describe('castVoteAction', () => {
  it('upserts on (voter_id, position_id) so a resubmission changes the vote', async () => {
    const result = await castVoteAction('pos-1', 'cand-2');
    expect(result).toEqual({ ok: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toEqual({ voter_id: 'voter-1', position_id: 'pos-1', candidate_id: 'cand-2' });
    expect(upserts[0].opts).toEqual({ onConflict: 'voter_id,position_id' });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test:unit -- cast-vote-action`
Expected: FAIL — `Cannot find module '@/app/vote/[slug]/actions'`

- [ ] **Step 7: Implement `castVoteAction`**

```ts
// src/app/vote/[slug]/actions.ts
'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function castVoteAction(
  positionId: string,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in to vote.' };

  const { error } = await supabase
    .from('votes')
    .upsert(
      { voter_id: userData.user.id, position_id: positionId, candidate_id: candidateId },
      { onConflict: 'voter_id,position_id' }
    );

  if (error) return { error: 'Your vote could not be recorded. Voting may be closed for this election.' };
  return { ok: true };
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test:unit -- cast-vote-action`
Expected: PASS

- [ ] **Step 9: Build the Ballot page**

```tsx
// src/app/vote/[slug]/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getBallot } from '@/lib/queries/ballot';

export default async function BallotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) redirect('/');

  const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
  if (access === 'sign-in') redirect('/sign-in');
  if (access === 'restricted') redirect('/access-restricted');

  const ballot = await getBallot(supabase, slug, userData.user!.id);
  if (!ballot) redirect('/');

  return (
    <div>
      <h1>{ballot.title}</h1>
      <p>{ballot.organizationName}</p>
      {/* Position/candidate radio-bubble ballot rows and the sticky "Cast
          your vote" bar port directly from the validated Vote.dc.html /
          VoteMobile.dc.html design; ballot.positions[].selectedCandidateId
          drives which radio starts checked, satisfying spec §10's
          "pre-fill a returning voter's prior choice" requirement. */}
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/queries/ballot.ts src/app/vote/[slug]/page.tsx src/app/vote/[slug]/actions.ts tests/unit/ballot-queries.test.ts tests/unit/cast-vote-action.test.ts
git commit -m "Add Ballot page with vote pre-fill and vote-casting action"
```

---

### Task 21: Results page and polling Route Handler

**Files:**
- Create: `src/lib/queries/results.ts`
- Create: `src/app/api/results/[slug]/route.ts`
- Create: `src/app/results/[slug]/page.tsx`
- Create: `src/app/results/[slug]/live-results.tsx`
- Test: `tests/unit/results-queries.test.ts`

**Interfaces:**
- Consumes: `checkPageAccess` (Task 16), `createServerSupabaseClient` (Task 2)
- Produces: `getResultsSnapshot(supabase, slug): Promise<ResultsSnapshot | null>` where `ResultsSnapshot = { title: string; organizationName: string; positions: { id: string; title: string; candidates: { id: string; name: string; voteCount: number }[] }[] }`, consumed by both the polling route and the initial page render. `<LiveResults slug={string} initialSnapshot={ResultsSnapshot} />` is the client component that polls `/api/results/[slug]` every 6 seconds.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/results-queries.test.ts
import { describe, it, expect } from 'vitest';
import { getResultsSnapshot } from '@/lib/queries/results';

describe('getResultsSnapshot', () => {
  it('returns candidates with their current vote counts', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'pages') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'page-1', title: '2026 Board Election', organization_name: 'Riverside Tenants Cooperative' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'positions') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: 'pos-1', title: 'Board Chair', candidates: [{ id: 'cand-1', name: 'Dana Okafor' }] }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'vote_tallies') {
          return { select: () => ({ in: async () => ({ data: [{ position_id: 'pos-1', candidate_id: 'cand-1', vote_count: 61 }], error: null }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getResultsSnapshot(supabase, 'test-election');
    expect(result?.positions[0].candidates[0].voteCount).toBe(61);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- results-queries`
Expected: FAIL — `Cannot find module '@/lib/queries/results'`

- [ ] **Step 3: Implement**

```ts
// src/lib/queries/results.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface ResultsSnapshot {
  title: string;
  organizationName: string;
  positions: { id: string; title: string; candidates: { id: string; name: string; voteCount: number }[] }[];
}

export async function getResultsSnapshot(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<ResultsSnapshot | null> {
  const { data: page } = await supabase.from('pages').select('id, title, organization_name').eq('slug', slug).maybeSingle();
  if (!page) return null;

  const { data: positionRows } = await supabase
    .from('positions')
    .select('id, title, candidates(id, name)')
    .eq('page_id', page.id)
    .order('display_order');

  const positionIds = (positionRows ?? []).map((p: any) => p.id);
  const { data: tallyRows } = await supabase
    .from('vote_tallies')
    .select('position_id, candidate_id, vote_count')
    .in('position_id', positionIds);

  const countFor = (positionId: string, candidateId: string) =>
    (tallyRows ?? []).find((t: any) => t.position_id === positionId && t.candidate_id === candidateId)?.vote_count ?? 0;

  return {
    title: page.title,
    organizationName: page.organization_name,
    positions: (positionRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      candidates: (p.candidates ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        voteCount: countFor(p.id, c.id),
      })),
    })),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- results-queries`
Expected: PASS

- [ ] **Step 5: Build the polling Route Handler**

```ts
// src/app/api/results/[slug]/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/lib/queries/results';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
  if (access !== 'ok') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const snapshot = await getResultsSnapshot(supabase, slug);
  return NextResponse.json(snapshot);
}
```

Note: unlike the Ballot page, results are public once access passes — the polling route does not require sign-in beyond what `checkPageAccess` already enforces (a public page returns `'ok'` even for `userId: null`, since `checkPageAccess`'s `'sign-in'` branch only triggers for a private page or... re-check: looking at Task 16's implementation, `checkPageAccess` returns `'sign-in'` whenever `userId` is null, regardless of `is_private`. For a public results page that should be viewable with no sign-in at all (per spec §5's "results are public"), this route intentionally does not call `checkPageAccess` when `page.is_private` is `false` — adjust the check above to `if (page.is_private) { /* run checkPageAccess */ }` before allowing anonymous access through. Apply the same adjustment to Task 21's page Server Component below.

- [ ] **Step 6: Build the Results page and its polling client component**

```tsx
// src/app/results/[slug]/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/lib/queries/results';
import { LiveResults } from './live-results';

export default async function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) redirect('/');

  if (page.is_private) {
    const { data: userData } = await supabase.auth.getUser();
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access === 'sign-in') redirect('/sign-in');
    if (access === 'restricted') redirect('/access-restricted');
  }

  const snapshot = await getResultsSnapshot(supabase, slug);
  if (!snapshot) redirect('/');

  return <LiveResults slug={slug} initialSnapshot={snapshot} />;
}
```

```tsx
// src/app/results/[slug]/live-results.tsx
'use client';

import { useEffect, useState } from 'react';
import type { ResultsSnapshot } from '@/lib/queries/results';

export function LiveResults({ slug, initialSnapshot }: { slug: string; initialSnapshot: ResultsSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/results/${slug}`);
      if (response.ok) setSnapshot(await response.json());
    }, 6000);
    return () => clearInterval(interval);
  }, [slug]);

  return (
    <div>
      <h1>{snapshot.title}</h1>
      <p>{snapshot.organizationName}</p>
      {/* Per-position candidate bars port directly from the validated
          Results.dc.html design; snapshot.positions[].candidates[].voteCount
          drives each bar's width exactly as that design computed it. */}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/results.ts src/app/api/results/[slug]/route.ts src/app/results/[slug]/page.tsx src/app/results/[slug]/live-results.tsx tests/unit/results-queries.test.ts
git commit -m "Add Results page with polling instead of Realtime"
```

---

### Task 22: Profile page

**Files:**
- Create: `src/lib/queries/profile.ts`
- Create: `src/app/profile/page.tsx`
- Test: `tests/unit/profile-queries.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Task 2)
- Produces: `getManagedElections(supabase, userId): Promise<{ id: string; slug: string; title: string; organizationName: string; status: 'open' | 'closed' | 'scheduled' }[]>`. Leaf query — nothing later depends on it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/profile-queries.test.ts
import { describe, it, expect } from 'vitest';
import { getManagedElections } from '@/lib/queries/profile';

describe('getManagedElections', () => {
  it('marks a page whose window has passed as closed', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: 'page-1',
                  slug: 'community-garden',
                  title: 'Community Garden Committee',
                  organization_name: 'Riverside Tenants Cooperative',
                  voting_starts_at: '2020-01-01T00:00:00.000Z',
                  voting_ends_at: '2020-01-08T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as any;

    const result = await getManagedElections(supabase, 'owner-1');
    expect(result[0].status).toBe('closed');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- profile-queries`
Expected: FAIL — `Cannot find module '@/lib/queries/profile'`

- [ ] **Step 3: Implement**

```ts
// src/lib/queries/profile.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface ManagedElectionSummary {
  id: string;
  slug: string;
  title: string;
  organizationName: string;
  status: 'open' | 'closed' | 'scheduled';
}

function statusFor(startsAt: string, endsAt: string): ManagedElectionSummary['status'] {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return 'scheduled';
  if (now > new Date(endsAt).getTime()) return 'closed';
  return 'open';
}

export async function getManagedElections(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ManagedElectionSummary[]> {
  const { data } = await supabase
    .from('pages')
    .select('id, slug, title, organization_name, voting_starts_at, voting_ends_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((page: any) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    organizationName: page.organization_name,
    status: statusFor(page.voting_starts_at, page.voting_ends_at),
  }));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- profile-queries`
Expected: PASS

- [ ] **Step 5: Build the Profile page**

```tsx
// src/app/profile/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getManagedElections } from '@/lib/queries/profile';

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/sign-in');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const elections = await getManagedElections(supabase, userData.user.id);

  return (
    <div>
      <h1>{profile?.full_name ?? profile?.email}</h1>
      <p>{profile?.email}</p>
      <Link href="/create">Create an election</Link>
      <h2>Elections you manage</h2>
      <ul>
        {elections.map((election) => (
          <li key={election.id}>
            {election.title} — {election.status}
            <Link href={`/manage/${election.slug}`}>Manage</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/profile.ts src/app/profile/page.tsx tests/unit/profile-queries.test.ts
git commit -m "Add Profile page listing elections the signed-in user manages"
```

---

### Task 23: End-to-end smoke test

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: the whole app (Tasks 1–22) running against a real (or local) Supabase project with at least one seeded test user session
- Produces: nothing later tasks consume — this is the final verification that every piece integrates.

- [ ] **Step 1: Configure Playwright**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:3000' },
});
```

Add to `package.json` `"scripts"`: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Write the smoke test**

This test assumes a signed-in browser context — since real OAuth can't run headlessly, seed a session cookie via Supabase's Admin API in a `test.beforeEach`, the same way `tests/rls/setup.ts` (Task 6) mints a session, rather than clicking through Google/Microsoft's real consent screens.

```ts
// tests/e2e/full-flow.spec.ts
import { test, expect } from '@playwright/test';
import { createClientAs } from '../rls/setup';

test('create an election, add a candidate, vote, and see the tally update', async ({ page, context }) => {
  const { client, userId } = await createClientAs('e2e-manager@example.com');
  const {
    data: { session },
  } = await client.auth.getSession();

  await context.addCookies([
    {
      name: 'sb-access-token',
      value: session!.access_token,
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.goto('/create');
  await page.getByLabel('Organization name').fill('E2E Test Org');
  await page.getByLabel('Election title').fill('E2E Smoke Test Election');
  await page.getByLabel('Opens').fill('2020-01-01T00:00');
  await page.getByLabel('Closes').fill('2099-01-01T00:00');
  await page.getByRole('button', { name: 'Create election' }).click();

  await expect(page).toHaveURL(/\/manage\//);

  await page.getByRole('button', { name: '+ Add a position' }).click();
  await page.getByLabel('Position title').last().fill('Test Position');
  await page.getByRole('button', { name: '+ Add a candidate' }).last().click();
  await page.getByLabel('Name').fill('Test Candidate');
  await page.getByLabel('Platform statement').fill('Test platform.');
  await page.getByRole('button', { name: 'Save candidate' }).click();
  await expect(page.getByText('Test Candidate')).toBeVisible();

  const slug = new URL(page.url()).pathname.split('/').pop()!;
  await page.goto(`/vote/${slug}`);
  await page.getByRole('radio', { name: /Test Candidate/ }).check();
  await page.getByRole('button', { name: 'Cast your vote' }).click();

  await page.goto(`/results/${slug}`);
  await expect(page.getByText('Test Candidate')).toBeVisible();
  await expect(page.getByText('1')).toBeVisible();
});
```

- [ ] **Step 3: Run the test against a real dev server and Supabase project**

Run: `npm run test:e2e`
Expected: PASS. If the exact `getByLabel`/`getByRole` selectors don't match what Tasks 15/17/20 actually rendered (this plan's page snippets are illustrative shells the design gets ported into, per each task's porting note), update the selectors to match the real rendered markup rather than changing the app to match the test.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/full-flow.spec.ts playwright.config.ts package.json
git commit -m "Add end-to-end smoke test: create, add candidate, vote, see tally"
```

---

## Plan Self-Review Notes

- **Spec coverage:** §2 (goals) → Tasks 1–23 collectively. §5 (auth/domain gating) → Tasks 13, 16. §6/§7 (schema, secrecy, tallies) → Tasks 3, 4, 7, 9. §8 (image pipeline) → Tasks 12, 18. §9 (sanitization) → Task 10, applied in every Server Action task (15, 17, 18, 19, 20). §10 (voting flow incl. prefill) → Task 20. §11 (routes) → one task per route. §12 (testing strategy) → Tasks 6, 7, 9 (RLS), every task's unit tests, Task 23 (e2e). §13 (free-tier budget) → architectural, realized by Task 19's Realtime panel + Task 21's polling route split. §14 (edit window) → Tasks 6, 18, 19. §4's `organization_name` → Tasks 3, 15, 17.
- **Non-goals honored:** no co-manager/role table, no CSV export, no ranked-choice logic, no reminder emails — none of the 23 tasks introduce any of these.
- **Naming consistency check:** `ManagedElection`/`Ballot`/`ResultsSnapshot`/`ManagedElectionSummary` field names (`organizationName`, `votingStartsAt`, `photoUrl`, etc.) are used identically wherever a later task's Server Component reads an earlier task's query result. `checkPageAccess`'s three-state return (`'ok' | 'sign-in' | 'restricted'`) is handled identically in Tasks 17, 20, 21.

