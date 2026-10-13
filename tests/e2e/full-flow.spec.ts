import { test, expect } from '@playwright/test';
import { createClientAs } from '../rls/setup';

// NOTE on scope: this covers the golden path that is wired end-to-end through
// the current UI: sign in, fill the real "create election" form (including the
// required position and candidate), follow the real Server Action's redirect,
// and confirm the Manager Console renders what was submitted, loaded via a
// real query against the local Supabase/Postgres stack. Voting and live
// results are not driven through the browser here.

function projectRefFromSupabaseUrl(url: string): string {
  // Mirrors supabase-js's own default storageKey derivation
  // (`sb-${new URL(url).hostname.split('.')[0]}-auth-token`) so the cookie we
  // seed here has the exact name @supabase/ssr's server client looks for.
  return new URL(url).hostname.split('.')[0];
}

// datetime-local inputs take 'YYYY-MM-DDTHH:mm' in the browser's local time.
function daysFromNowLocal(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  const positionTitle = `Chair ${uniqueSuffix}`;
  const candidateName = `Dana Okafor ${uniqueSuffix}`;

  await page.goto('/create');
  await page.getByLabel('Organization name').fill(organizationName);
  await page.getByLabel('Election title').fill(title);
  // Creation rejects a start time that isn't in the future.
  await page.getByLabel('Opens').fill(daysFromNowLocal(7));
  await page.getByLabel('Closes').fill(daysFromNowLocal(14));

  // An election needs at least one position, and each position at least one candidate.
  await page.getByRole('button', { name: '+ Add a position' }).click();
  // The position title input has no accessible label of its own.
  await page.locator('div:has(> label:text("Position title")) > input').fill(positionTitle);
  await page.getByRole('button', { name: '+ Add a candidate' }).click();
  await page.getByRole('dialog', { name: 'Candidate' }).getByLabel('Name').fill(candidateName);
  await page.getByRole('button', { name: 'Save candidate' }).click();

  await page.getByRole('button', { name: 'Create election' }).click();

  // Real Server Action -> real Postgres insert -> real router.push redirect.
  await expect(page).toHaveURL(/\/manage\//, { timeout: 10_000 });

  // Manager Console (src/app/manage/[ownerId]/[slug]/page.tsx) renders
  // `<h1>{election.title}</h1>` and `<p>{election.organizationName}</p>`,
  // loaded fresh from the database via getManagedElection — this confirms
  // the full round trip actually persisted and reloaded the right data.
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(organizationName)).toBeVisible();
  await expect(page.getByRole('heading', { name: positionTitle })).toBeVisible();
  await expect(page.getByText(candidateName)).toBeVisible();
});
