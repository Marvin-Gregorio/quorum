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
