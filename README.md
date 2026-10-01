# Quorum — voting system

A Next.js app (App Router) backed by Supabase (Postgres + Auth + Storage +
Realtime) for running org-wide elections: positions, candidates, domain-gated
private elections, live results, and RLS-enforced ballot secrecy.

See [AGENTS.md](AGENTS.md) for the full architecture and code conventions
this project follows (RLS-first authorization, Server Actions, Tailwind
usage, etc.) — read it before opening a PR.

## Requirements

- **Node.js >= 22** (enforced via `package.json`'s `engines` field).
  `@supabase/supabase-js`'s realtime client specifically depends on APIs
  only available from Node 22 onward, which is what the test suites
  (`test:rls`, `test:e2e`) need it for. If `node -v` reports something
  older, install Node 22+ (e.g. via `nvm` or Homebrew).
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

3. Sign-in is OAuth-only (Google and Microsoft) — there's no password login,
   so you need your own OAuth app credentials even for local development:

   - **Google**: create an OAuth client in the
     [Google Cloud Console](https://developers.google.com/identity/protocols/oauth2),
     then set `GOOGLE_CLIENT_ID`/`GOOGLE_SECRET` in `.env.local`.
   - **Microsoft**: register an app in
     [Azure AD](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app),
     then set `AZURE_CLIENT_ID`/`AZURE_SECRET` in `.env.local`.

   Both are read by `supabase/config.toml`'s `[auth.external.google]`/
   `[auth.external.azure]` blocks automatically — no other config needed.
   The redirect URI to register with each provider is
   `http://localhost:54321/auth/v1/callback` for local development (Supabase
   Auth's own callback, not the app's `/auth/callback` route).

4. Run a local Supabase stack (recommended for development), or link to a
   hosted project instead:

   ```bash
   npx supabase start
   ```

   This starts Postgres, Auth, Storage, and Realtime locally via Docker and
   prints the local API URL and keys to use in `.env.local`. Alternatively,
   run `npx supabase link` to point at a hosted Supabase project.

5. Apply database migrations:

   ```bash
   npx supabase migration up --local
   ```

   (Drop `--local` if you're migrating a linked hosted project instead.)

6. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

Rate limiting on election creation, voting, and public results polling uses
[Upstash Redis](https://upstash.com) — optional for local development
(it no-ops without credentials) but required in production. Set
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` in `.env.local` if you
want to exercise it locally.

## Tests

- `npm run test:unit` — unit tests (`tests/unit`), no external services
  required.
- `npm run test:rls` — RLS/integration tests (`tests/rls`) against a real
  local Supabase stack. Just run `npx supabase start` first — the env vars
  these tests need (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) are populated automatically from
  `supabase status` by [tests/rls/global-setup.ts](tests/rls/global-setup.ts),
  no manual setup required. Needs Node >= 22 (see Requirements above).
- `npm run test:e2e` — Playwright end-to-end tests (`tests/e2e`). Also needs
  a running local Supabase stack and Node >= 22.

## Before opening a PR

Run the same checks CI runs ([.github/workflows/ci.yml](.github/workflows/ci.yml)):

```bash
npm run lint
npm run test:unit
npm run test:rls
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution process.

## Releases

Versioning is managed with [Changesets](https://github.com/changesets/changesets)
and is on-demand, not automatic: a bot keeps a "Version Packages" PR up to
date on `main` as changesets accumulate, and merging that PR is the one
manual step that cuts a release — a git tag and GitHub Release are then
created automatically
([.github/workflows/release.yml](.github/workflows/release.yml)).
