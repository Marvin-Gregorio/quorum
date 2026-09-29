import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the test environment
// (a .env.test file, not committed) so the helper can mint real user sessions
// via the Admin API for RLS tests to run as.
// All clients below disable session persistence/auto-refresh. Without this,
// every createClient() call against the same SUPABASE_URL in a test process
// shares the same localStorage-backed session key (it's keyed by project
// ref, not by API key), so calling verifyOtp() for one test user silently
// overwrites the "current session" that other clients — including the
// service-role client — pick up and use instead of their own key. That
// turns a service-role query into an authenticated-as-whoever-logged-in-last
// query, which looks exactly like an RLS failure but is really the wrong
// role being used. Disabling persistence keeps each client's identity fixed
// to whatever was passed to createClient/explicit headers.
const NO_PERSIST_AUTH = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export async function createClientAs(email: string) {
  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    NO_PERSIST_AUTH
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
    process.env.SUPABASE_ANON_KEY!,
    NO_PERSIST_AUTH
  );
  // Note: linkData.properties.hashed_token is for the GET /verify redirect
  // flow (action_link); the POST /verify path that verifyOtp() calls expects
  // the 6-digit email_otp code instead, or verification fails with
  // "otp_expired" even immediately after the link is generated.
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;

  const client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      ...NO_PERSIST_AUTH,
      global: { headers: { Authorization: `Bearer ${verifyData.session!.access_token}` } },
    }
  );
  return { client, userId: user.id };
}

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    NO_PERSIST_AUTH
  );
}
