import { execSync } from 'node:child_process';

// `npm run test:unit` invokes `vitest run tests/unit`; `npm run test:rls`
// invokes `vitest run tests/rls` (see package.json) — only the latter needs
// a live Supabase stack, so skip entirely rather than shelling out to
// `supabase status` (slow, and fails loudly if Docker isn't running) on
// every plain unit-test run too.
function targetsRlsTests(): boolean {
  const args = process.argv.slice(2);
  return args.some((arg) => arg.includes('tests/rls')) || !args.some((arg) => arg.includes('tests/unit'));
}

// Populates SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY (read by
// tests/rls/setup.ts) from a local `supabase start` stack, so a developer
// doesn't have to manually export them before every `npm run test:rls` run.
// Registered as a Vitest globalSetup, so it also runs for `test:unit` — exits
// immediately there via the guards below rather than needing a separate
// Vitest project just to scope it to tests/rls.
export default function setup() {
  if (!targetsRlsTests()) return;

  // CI already exports these itself (see the `rls` job in
  // .github/workflows/ci.yml) only for jobs that need them — a CI job that
  // doesn't set them (e.g. `unit`, `build`) deliberately has no local
  // Supabase stack to query, so don't try.
  if (process.env.CI) return;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }));
    process.env.SUPABASE_URL ??= status.API_URL;
    process.env.SUPABASE_ANON_KEY ??= status.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= status.SERVICE_ROLE_KEY;
  } catch {
    // No local stack running (or Docker is down) — tests/rls/setup.ts will
    // fail with a clear "supabaseUrl is required" error instead, which
    // already points at the real problem (run `npx supabase start` first).
  }
}
