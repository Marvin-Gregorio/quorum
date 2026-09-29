import { test, expect } from '@playwright/test';
import { createClientAs } from '../rls/setup';

// NOTE on scope: the plan's originally-envisioned e2e flow (create an
// election, add a position, add a candidate via a modal, cast a vote via
// radio buttons, and see the tally update) cannot be driven through the
// browser today. Every page task before this one (15, 17, 18, 19, 20, 21)
// deliberately shipped a "minimal shell" — real Server Actions and real data
// loading, but without the interactive UI (add-position/add-candidate
// modals, the ballot's radio bubbles, the live results bars) that a later
// "porting" pass was supposed to add. No task in this plan actually did that
// porting, so those controls do not exist in the rendered output.
//
// This test instead covers the golden path that IS real and fully wired
// end-to-end through the current UI: sign in, submit the real "create
// election" form, follow the real Server Action's redirect, and confirm the
// Manager Console renders the data that was just submitted, loaded via a
// real query against the local Supabase/Postgres stack.

function projectRefFromSupabaseUrl(url: string): string {
  // Mirrors supabase-js's own default storageKey derivation
  // (`sb-${new URL(url).hostname.split('.')[0]}-auth-token`) so the cookie we
  // seed here has the exact name @supabase/ssr's server client looks for.
  return new URL(url).hostname.split('.')[0];
}

test('create an election and land on its Manager Console with the submitted data', async ({
  page,
  context,
}) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL must be set in the test environment (see .env.test).');
  }

  const { session } = await createClientAs('e2e-manager@example.com');
  if (!session) {
    throw new Error('Failed to mint a session for the e2e test user.');
  }

  // Seed a real, valid Supabase auth session cookie so the app's own
  // middleware and server components (which read cookies via @supabase/ssr,
  // not localStorage) see us as signed in — without driving a real OAuth
  // consent screen, which can't run headlessly.
  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const uniqueSuffix = Date.now();
  const organizationName = `E2E Test Org ${uniqueSuffix}`;
  const title = `E2E Smoke Test Election ${uniqueSuffix}`;

  await page.goto('/create');
  await page.getByLabel('Organization name').fill(organizationName);
  await page.getByLabel('Election title').fill(title);
  await page.getByLabel('Opens').fill('2020-01-01T00:00');
  await page.getByLabel('Closes').fill('2099-01-01T00:00');
  await page.getByRole('button', { name: 'Create election' }).click();

  // Real Server Action -> real Postgres insert -> real router.push redirect.
  await expect(page).toHaveURL(/\/manage\//, { timeout: 10_000 });

  // Manager Console (src/app/manage/[slug]/page.tsx) renders
  // `<h1>{election.title}</h1>` and `<p>{election.organizationName}</p>`,
  // loaded fresh from the database via getManagedElection — this confirms
  // the full round trip actually persisted and reloaded the right data.
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(organizationName)).toBeVisible();
});
