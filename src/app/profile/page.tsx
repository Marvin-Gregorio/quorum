import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getManagedElections } from '@/lib/queries/profile';
import { UserMenu } from '@/components/user-menu';
import { initialsFor } from '@/lib/avatar';

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

      <nav aria-label="Breadcrumb" style={{ padding: '16px clamp(24px,5vw,64px) 0' }}>
        <ol className="breadcrumb-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--ink)' }}>
            Profile
          </li>
        </ol>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: '32px 24px 64px', flexGrow: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--paper)',
              fontFamily: "'Fraunces', serif",
              fontSize: 26,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initialsFor(displayName)}
          </div>
          <div>
            <h1 style={{ fontSize: 26, marginBottom: 4 }}>{displayName}</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>{profile?.email ?? userData.user.email}</p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 4,
            }}
          >
            <h2 style={{ fontSize: 19 }}>Elections you manage</h2>
            <Link href="/create" className="primary-btn">
              Create an election
            </Link>
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '0 0 8px' }}>
            You can only manage an election if you&apos;re the one who created it.
          </p>

          {elections.length === 0 ? (
            <p style={{ color: 'var(--ink-2)', fontSize: 14, padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              You haven&apos;t created any elections yet.
            </p>
          ) : (
            elections.map((election) => (
              <div className="election-row" key={election.id}>
                <div>
                  <div style={{ fontWeight: 500 }}>{election.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{election.organizationName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`status-badge status-${election.status}`}>{STATUS_LABEL[election.status]}</span>
                  <Link href={`/manage/${election.slug}`} className="manage-link">
                    Manage
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
