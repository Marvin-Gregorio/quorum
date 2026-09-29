import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserMenu } from '@/components/user-menu';
import { CreateElectionForm } from './create-election-form';

export default async function CreateElectionPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/sign-in?next=${encodeURIComponent('/create')}`);
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px clamp(24px,5vw,64px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 20 }}>
          Quorum
        </div>
        <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user.email ?? null} />
      </header>

      <CreateElectionForm />
    </div>
  );
}
