# Contributing to Quorum

Thanks for considering a contribution — here's how this project works.

## Getting set up

See [README.md](README.md) for environment setup (Node version, Supabase
CLI/Docker, OAuth provider credentials, running the dev server and tests).

## Code conventions

See [AGENTS.md](AGENTS.md) for architecture and style conventions — RLS-first
authorization, Server Actions as the only boundary between the UI and
Supabase, Tailwind-only styling, file naming, and the business rules around
voting/ballot secrecy. Read it before making non-trivial changes; PRs that
don't follow it will likely need rework.

## Workflow

This repo uses the standard GitHub fork-and-pull-request model:

1. Fork the repo to your own account.
2. Clone your fork and create a branch off `main` for your change.
3. Make your change, following the conventions above.
4. Run the same checks CI runs before opening a PR:

   ```bash
   npm run lint
   npm run test:unit
   npm run test:rls
   npm run build
   ```

5. Push to your fork and open a pull request against `main` on this repo.
   Describe what changed and why; link any related issue.

PRs are expected to pass CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))
before being merged.

## Reporting bugs / requesting features

Open an issue using the appropriate template. For a security vulnerability,
do **not** open a public issue — see [SECURITY.md](SECURITY.md) instead.

## Code of conduct

Participation in this project is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).
