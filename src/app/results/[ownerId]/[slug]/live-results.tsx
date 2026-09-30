'use client';

import { useEffect, useState } from 'react';
import type { ResultsSnapshot } from '@/lib/queries/results';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { toRoman } from '@/lib/roman';
import { useLiveVoteTallies } from '@/lib/hooks/use-live-vote-tallies';

export function LiveResults({
  ownerId,
  slug,
  initialSnapshot,
  isOwner,
}: {
  ownerId: string;
  slug: string;
  initialSnapshot: ResultsSnapshot;
  isOwner: boolean;
}) {
  // Owners get Realtime (same vote_tallies subscription the Manager Console
  // uses); everyone else polls, to keep the free-tier Realtime connection
  // budget spent only on the people actively managing an election.
  const [polledSnapshot, setPolledSnapshot] = useState(initialSnapshot);

  const positionIds = initialSnapshot.positions.map((p) => p.id);
  const initialTallies = initialSnapshot.positions.flatMap((p) =>
    p.candidates.map((c) => ({ positionId: p.id, candidateId: c.id, voteCount: c.voteCount }))
  );
  const liveTallies = useLiveVoteTallies({
    pageId: initialSnapshot.pageId,
    positionIds,
    initialTallies,
    enabled: isOwner,
  });

  useEffect(() => {
    if (isOwner) return;
    const interval = setInterval(async () => {
      // Skip polling while the tab isn't visible, so results don't keep
      // fetching forever in a backgrounded tab.
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/results/${ownerId}/${slug}`);
        if (response.ok) setPolledSnapshot(await response.json());
      } catch {
        // A transient network failure shouldn't crash the poll loop or
        // produce an unhandled rejection; just try again next tick.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isOwner, ownerId, slug]);

  // The structure (titles, candidate names) never changes here — only vote
  // counts do — so the owner's live view overlays fresh tallies onto the
  // original snapshot shape, while everyone else gets the fully-replaced
  // snapshot straight from the last poll.
  const snapshot: ResultsSnapshot = isOwner
    ? {
        ...initialSnapshot,
        positions: initialSnapshot.positions.map((p) => ({
          ...p,
          candidates: p.candidates.map((c) => ({
            ...c,
            voteCount:
              liveTallies.find((t) => t.positionId === p.id && t.candidateId === c.id)?.voteCount ?? c.voteCount,
          })),
        })),
      }
    : polledSnapshot;

  return (
    <>
      <div className="max-w-[820px] mx-auto w-full px-6 pt-6 pb-16 grow">
        <p className="text-sm text-ink-2 m-0 mb-1">{snapshot.organizationName}</p>
        <h1 className="text-[clamp(26px,4vw,34px)] m-0 mb-4">{snapshot.title}</h1>
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ledger inline-block" />
          Live results. Updates automatically as votes are cast.
        </div>

        {snapshot.positions.map((pos, pi) => {
          const total = pos.candidates.reduce((sum, c) => sum + c.voteCount, 0);
          const maxVotes = Math.max(0, ...pos.candidates.map((c) => c.voteCount));
          return (
            <div className="position-block" key={pos.id}>
              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-['Fraunces',serif] italic text-lg text-ink-2">
                  {toRoman(pi + 1)}.
                </span>
                <h2 className="text-[22px]">{pos.title}</h2>
              </div>
              {pos.candidates.map((cand, ci) => {
                const isLeader = total > 0 && cand.voteCount === maxVotes;
                const pct = total > 0 ? Math.round((cand.voteCount / total) * 100) : 0;
                return (
                  <div className="mb-5" key={cand.id}>
                    <div className="candidate-line">
                      <div className="candidate-name-group">
                        <div className={cn('avatar', colorClassForIndex(ci))}>
                          {initialsFor(cand.name)}
                        </div>
                        <span className={cn('text-base', isLeader ? 'font-semibold text-seal-dark' : 'font-medium text-ink')}>
                          {cand.name}
                        </span>
                      </div>
                      <span className={cn('font-[\'Fraunces\',serif] text-xl', isLeader ? 'text-seal-dark' : 'text-ink-2')}>
                        {cand.voteCount}
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className={cn('bar-fill', isLeader ? 'bg-seal' : 'bg-ink-2')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-line py-6 px-[clamp(24px,5vw,64px)] text-[13px] text-ink-2">
        Results are shown as they&apos;re recorded. No one, including the election&apos;s organizer, can see how any
        individual person voted.
      </footer>
    </>
  );
}
