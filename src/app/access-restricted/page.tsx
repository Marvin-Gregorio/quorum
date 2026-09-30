import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { PRIMARY_BTN } from '@/lib/ui-classes';
import { cn } from '@/lib/cn';

// Only a same-origin relative path is a safe redirect target — see
// auth/callback/route.ts's isSafeNextPath for the same rule and rationale.
function isSafeNextPath(next: string | undefined): next is string {
  return !!next && next.startsWith('/') && !next.startsWith('//');
}

export default async function AccessRestrictedPage({
  searchParams,
}: {
  searchParams: Promise<{ pageId?: string; next?: string }>;
}) {
  const { pageId, next } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  let heading = 'You do not have access to this election.';
  if (pageId) {
    // A rejected visitor is, by definition, someone the "pages" select policy
    // hides this row from — a plain RLS-gated lookup would come back null
    // here every time, so this reliably needs to bypass RLS just to learn
    // is_private (nothing else).
    const { data: isPrivate } = await supabase.rpc('get_page_privacy', { p_page_id: pageId });
    if (isPrivate) {
      const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', pageId);
      const domainList = (domainRows ?? []).map((d) => d.domain);
      heading = domainList.length
        ? `This election is only open to ${domainList.join(', ')}`
        : 'This election is only open to its creator.';
    }
  }

  return (
    <>
      <Header />

      <div className="grow flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] text-center">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            role="img"
            aria-label="A stamp marked not eligible"
            className="mx-auto mb-8 block"
          >
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-seal)" strokeWidth="3" opacity="0.85" />
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--color-seal)" strokeWidth="1.5" opacity="0.85" />
            <text
              x="60"
              y="56"
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontWeight="700"
              fontSize="15"
              fill="var(--color-seal)"
              opacity="0.85"
              transform="rotate(-10 60 56)"
            >
              NOT ELIGIBLE
            </text>
            <text
              x="60"
              y="76"
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontStyle="italic"
              fontSize="11"
              fill="var(--color-seal)"
              opacity="0.85"
              transform="rotate(-10 60 76)"
            >
              Quorum
            </text>
          </svg>

          <h1 className="text-2xl mb-3">{heading}</h1>
          <p className="text-ink-2 text-[15px] leading-[1.6] m-0 mb-8">
            {userData.user?.email
              ? `You're signed in as ${userData.user.email}. Ask the organizer to add your email domain, or sign in with a different account.`
              : 'Ask the organizer to add your email domain, or sign in with a different account.'}
          </p>

          <div className="flex flex-col gap-3 items-center">
            <Link
              href={isSafeNextPath(next) ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
              className={cn(PRIMARY_BTN, 'px-7 py-[14px] text-[15px]')}
            >
              Sign in with a different account
            </Link>
            <Link href="/" className="text-sm underline underline-offset-[3px]">
              Return home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
