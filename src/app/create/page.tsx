import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { CreateElectionForm } from './create-election-form';

export default async function CreateElectionPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/sign-in?next=${encodeURIComponent('/create')}`);
  }

  return (
    <>
      <Header />

      <CreateElectionForm />
    </>
  );
}
