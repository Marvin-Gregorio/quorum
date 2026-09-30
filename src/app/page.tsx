import Link from 'next/link';
import { PRIMARY_BTN, SIGNIN_BTN } from '@/lib/ui-classes';
import { cn } from '@/lib/cn';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-[clamp(24px,5vw,64px)] py-7 border-b border-line">
        <div className="font-['Fraunces',serif] italic font-semibold text-[22px]">
          Quorum
        </div>
        <nav className="flex gap-5 items-center text-[15px]">
          <a href="#how-it-works" className="no-underline">
            How it works
          </a>
          <Link href="/sign-in" className={SIGNIN_BTN}>
            Sign in
          </Link>
        </nav>
      </header>

      <section className="grow flex flex-wrap-reverse items-center gap-12 py-[clamp(40px,8vw,96px)] px-[clamp(24px,5vw,64px)] max-w-[1280px] mx-auto w-full">
        <div className="flex-[1_1_420px] min-w-[280px]">
          <h1 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.01em] m-0 mb-6 max-w-[13ch]">
            Run a vote your whole organization can trust.
          </h1>
          <p className="text-lg leading-[1.6] text-ink-2 max-w-[46ch] m-0 mb-8">
            Set up positions and candidates, choose which email domains are allowed to vote, and watch results come
            in as ballots are cast.
          </p>
          <div className="flex gap-4 flex-wrap items-center">
            <Link href="/create" className={cn(PRIMARY_BTN, 'px-7 py-[14px] text-base')}>
              Create an election
            </Link>
          </div>
        </div>
        <div className="flex-[1_1_320px] min-w-[260px] flex justify-center">
          <svg width="260" height="260" viewBox="0 0 280 280" role="img" aria-label="A folded ballot being placed into a ballot box">
            <rect x="40" y="120" width="200" height="130" rx="4" fill="var(--color-paper-2)" stroke="var(--color-ink)" strokeWidth="3" />
            <rect x="40" y="190" width="200" height="14" fill="var(--color-seal)" />
            <rect x="30" y="100" width="220" height="26" rx="3" fill="var(--color-ink)" />
            <rect x="120" y="106" width="40" height="8" rx="2" fill="var(--color-paper)" />
            <g transform="rotate(-8 150 70)">
              <rect x="110" y="20" width="80" height="100" rx="2" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
              <line x1="122" y1="38" x2="178" y2="38" stroke="var(--color-ink-2)" strokeWidth="2" />
              <line x1="122" y1="50" x2="178" y2="50" stroke="var(--color-ink-2)" strokeWidth="2" />
              <circle cx="128" cy="66" r="5" fill="none" stroke="var(--color-ink-2)" strokeWidth="2" />
              <line x1="140" y1="66" x2="178" y2="66" stroke="var(--color-line-strong)" strokeWidth="2" />
              <circle cx="128" cy="82" r="5" fill="var(--color-seal)" stroke="var(--color-seal)" strokeWidth="2" />
              <line x1="140" y1="82" x2="178" y2="82" stroke="var(--color-ink)" strokeWidth="2" />
            </g>
          </svg>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-line py-[clamp(48px,6vw,80px)] px-[clamp(24px,5vw,64px)] max-w-[1280px] mx-auto w-full"
      >
        <h2 className="text-[28px] mb-10">How it works</h2>
        <div className="flex gap-12 flex-wrap">
          <div className="flex-[1_1_240px] min-w-[220px]">
            <div className="font-['Fraunces',serif] text-[32px] text-seal mb-3">
              1
            </div>
            <h3 className="text-lg mb-2">Set up the ballot</h3>
            <p className="text-ink-2 leading-[1.6] m-0">
              Add each position and its candidates, and decide who&apos;s allowed to vote — anyone, or just people
              with a matching email domain.
            </p>
          </div>
          <div className="flex-[1_1_240px] min-w-[220px]">
            <div className="font-['Fraunces',serif] text-[32px] text-seal mb-3">
              2
            </div>
            <h3 className="text-lg mb-2">Share two links</h3>
            <p className="text-ink-2 leading-[1.6] m-0">
              One link for people to vote, one for anyone to watch results. Voters sign in with Google or Microsoft,
              so each person gets exactly one vote per position.
            </p>
          </div>
          <div className="flex-[1_1_240px] min-w-[220px]">
            <div className="font-['Fraunces',serif] text-[32px] text-seal mb-3">
              3
            </div>
            <h3 className="text-lg mb-2">Watch it come in</h3>
            <p className="text-ink-2 leading-[1.6] m-0">
              Results update on their own as votes are cast. Nobody, including you, can see how any one person voted.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 px-[clamp(24px,5vw,64px)] flex justify-between items-center text-sm text-ink-2 flex-wrap gap-2">
        <div className="font-['Fraunces',serif] italic">Quorum</div>
        <div>Free for small and mid-sized organizations</div>
      </footer>
    </div>
  );
}
