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
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center px-[clamp(24px,5vw,64px)] py-6 border-b border-line">
        <div className="font-['Fraunces',serif] italic font-semibold text-xl">
          Quorum
        </div>
        <UserMenu name={profile?.full_name ?? null} email={profile?.email ?? userData.user.email ?? null} />
      </header>

      <CreateElectionForm />
    </div>
  );
}
