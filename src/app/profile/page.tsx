import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getManagedElections } from '@/services/profile';
import { Header } from '@/components/header';
import { initialsFor } from '@/lib/avatar';
import { BREADCRUMB_LIST, BREADCRUMB_LINK, PRIMARY_BTN, STATUS_BADGE_BASE, STATUS_BADGE_VARIANT } from '@/lib/ui-classes';
import { cn } from '@/lib/cn';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  closed: 'Closed',
  scheduled: 'Scheduled',
};

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/sign-in?next=%2Fprofile');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const elections = await getManagedElections(supabase, userData.user.id);

  const displayName = profile?.full_name ?? profile?.email ?? '';

  return (
    <>
      <Header />

      <nav aria-label="Breadcrumb" className="pt-4 px-[clamp(24px,5vw,64px)] pb-0">
        <ol className={BREADCRUMB_LIST}>
          <li>
            <Link href="/" className={BREADCRUMB_LINK}>Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            Profile
          </li>
        </ol>
      </nav>

      <div className="max-w-[720px] mx-auto w-full px-6 pt-8 pb-16 grow">
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full bg-ink-2 flex items-center justify-center text-paper font-['Fraunces',serif] text-[26px] font-semibold shrink-0">
            {initialsFor(displayName)}
          </div>
          <div>
            <h1 className="text-2xl mb-1">{displayName}</h1>
            <p className="text-ink-2 text-sm m-0">{profile?.email ?? userData.user.email}</p>
          </div>
        </div>

        <div className="border-t border-line pt-7">
          <div className="flex justify-between items-start gap-4 flex-wrap mb-1">
            <h2 className="text-[19px]">Elections you manage</h2>
            <Link href="/create" className={PRIMARY_BTN}>
              Create an election
            </Link>
          </div>
          <p className="text-ink-2 text-sm m-0 mb-2">
            You can only manage an election if you&apos;re the one who created it.
          </p>

          {elections.length === 0 ? (
            <p className="text-ink-2 text-sm py-4 border-t border-line">
              You haven&apos;t created any elections yet.
            </p>
          ) : (
            elections.map((election) => (
              <div
                className="flex justify-between items-center py-[18px] border-b border-line gap-4 flex-wrap first:border-t"
                key={election.id}
              >
                <div>
                  <div className="font-medium">{election.title}</div>
                  <div className="text-[13px] text-ink-2 mt-0.5">{election.organizationName}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(STATUS_BADGE_BASE, STATUS_BADGE_VARIANT[election.status])}>
                    {STATUS_LABEL[election.status]}
                  </span>
                  <Link
                    href={`/manage/${userData.user.id}/${election.slug}`}
                    className="border border-ink bg-transparent rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink no-underline whitespace-nowrap"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
