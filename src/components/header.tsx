import type { ReactNode } from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/user-menu';
import { HeaderShell } from '@/components/header-shell';
import { SIGNIN_BTN } from '@/lib/ui-classes';

export async function Header({ children, showAuth = true }: { children?: ReactNode; showAuth?: boolean }) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const profile = userData.user
    ? (await supabase.from('profiles').select('full_name, email').eq('id', userData.user.id).maybeSingle()).data
    : null;

  const authSlot = !showAuth ? null : userData.user ? (
    <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user.email ?? null} />
  ) : (
    <Link href="/sign-in" className={SIGNIN_BTN}>
      Sign in
    </Link>
  );

  return <HeaderShell authSlot={authSlot}>{children}</HeaderShell>;
}
