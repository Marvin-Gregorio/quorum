import Link from 'next/link';
import { Header } from '@/components/header';
import { BallotIllustration } from '@/components/ballot-illustration';
import { GHOST_BTN, PRIMARY_BTN, SECONDARY_BTN } from '@/lib/ui-classes';
import { cn } from '@/lib/cn';
import { MoveRight } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Header>
        <a href="#how-it-works" className="no-underline">
          How it works
        </a>
      </Header>

      <section className="grow flex flex-wrap-reverse items-center gap-12 py-[clamp(40px,8vw,96px)] px-[clamp(24px,5vw,64px)] max-w-[1280px] mx-auto w-full">
        <div className="flex-[1_1_420px] min-w-[280px]">
          <h1 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.01em] m-0 mb-6 max-w-[13ch]">
            Run a vote your whole organization can trust.
          </h1>
          <p className="text-lg leading-[1.6] text-ink-2 max-w-[46ch] m-0 mb-8">
            Open source voting system. Set up positions and candidates, choose which email domains are allowed to vote, and watch results come
            in as ballots are cast.
          </p>
          <div className="flex gap-4 flex-wrap items-center">
            <Link href="/create" className={cn(PRIMARY_BTN, 'px-7 py-[14px] text-base')}>
              Create an election
            </Link>
            <Link href="https://github.com/marvin-gregorio/quorum" className={cn(GHOST_BTN, 'hover:border-b px-4 py-[14px] text-base flex items-center gap-4')}>
              Check open-source code
              <MoveRight />
            </Link>
          </div>
        </div>
        <div className="flex-[1_1_320px] min-w-[260px] flex justify-center max-md:hidden">
          <BallotIllustration />
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

    </>
  );
}
