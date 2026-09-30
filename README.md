# Quorum — voting system

A Next.js app (App Router) backed by Supabase (Postgres + Auth + Storage +
Realtime) for running org-wide elections: positions, candidates, domain-gated
private elections, live results, and RLS-enforced ballot secrecy.

## Requirements

- Node.js. The app itself targets Next's supported Node range, but the
  **test suites specifically require Node >= 22** (`@supabase/supabase-js`'s
  realtime client depends on APIs only available from Node 22 onward). If
  `node -v` reports something older, install Node 22+ (e.g. via `nvm` or
  Homebrew) before running `npm run test:rls` or `npm run test:e2e`.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`,
  no separate install needed) and Docker, for running a local Supabase stack.

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment example file and fill in your Supabase project's
   credentials:

   ```bash
   cp .env.local.example .env.local
   ```

   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from
   your Supabase project settings (or from `npx supabase status` if you're
   running the stack locally — see below).

3. Run a local Supabase stack (recommended for development), or link to a
   hosted project instead:

   ```bash
   npx supabase start
   ```

   This starts Postgres, Auth, Storage, and Realtime locally via Docker and
   prints the local API URL and keys to use in `.env.local`. Alternatively,
   run `npx supabase link` to point at a hosted Supabase project.

4. Apply database migrations:

   ```bash
   npx supabase migration up --local
   ```

   (Drop `--local` if you're migrating a linked hosted project instead.)

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Tests

- `npm run test:unit` — unit tests (`tests/unit`), no external services
  required.
- `npm run test:rls` — RLS/integration tests (`tests/rls`) against a real
  local Supabase stack. Requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` in the test environment (see `.env.test`,
  populated from `npx supabase status` after `npx supabase start`). Needs
  Node >= 22 (see Requirements above).
- `npm run test:e2e` — Playwright end-to-end tests (`tests/e2e`). Also needs
  a running local Supabase stack and Node >= 22.
