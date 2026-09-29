import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getManagedElections } from '@/lib/queries/profile';
import { signOutAction } from '@/app/auth/actions';

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/sign-in');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const elections = await getManagedElections(supabase, userData.user.id);

  return (
    <div>
      <h1>{profile?.full_name ?? profile?.email}</h1>
      <p>{profile?.email}</p>
      <Link href="/create">Create an election</Link>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
      <h2>Elections you manage</h2>
      <ul>
        {elections.map((election) => (
          <li key={election.id}>
            {election.title} — {election.status}
            <Link href={`/manage/${election.slug}`}>Manage</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
