'use client';

import { useEffect, useState } from 'react';
import type { ResultsSnapshot } from '@/lib/queries/results';
import { initialsFor, colorForIndex } from '@/lib/avatar';
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
      <div style={{ maxWidth: 820, margin: '0 auto', width: '100%', padding: '24px 24px 64px', flexGrow: 1 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 4px' }}>{snapshot.organizationName}</p>
        <h1 style={{ fontSize: 'clamp(26px,4vw,34px)', margin: '0 0 16px' }}>{snapshot.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-2)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ledger)', display: 'inline-block' }} />
          Live results. Updates automatically as votes are cast.
        </div>

        {snapshot.positions.map((pos, pi) => {
          const total = pos.candidates.reduce((sum, c) => sum + c.voteCount, 0);
          const maxVotes = Math.max(0, ...pos.candidates.map((c) => c.voteCount));
          return (
            <div className="position-block" key={pos.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink-2)' }}>
                  {toRoman(pi + 1)}.
                </span>
                <h2 style={{ fontSize: 22 }}>{pos.title}</h2>
              </div>
              {pos.candidates.map((cand, ci) => {
                const isLeader = total > 0 && cand.voteCount === maxVotes;
                const pct = total > 0 ? Math.round((cand.voteCount / total) * 100) : 0;
                return (
                  <div style={{ marginBottom: 20 }} key={cand.id}>
                    <div className="candidate-line">
                      <div className="candidate-name-group">
                        <div className="avatar" style={{ background: colorForIndex(ci) }}>
                          {initialsFor(cand.name)}
                        </div>
                        <span
                          style={{
                            fontWeight: isLeader ? 600 : 500,
                            fontSize: 16,
                            color: isLeader ? 'var(--seal-dark)' : 'var(--ink)',
                          }}
                        >
                          {cand.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: 20,
                          color: isLeader ? 'var(--seal-dark)' : 'var(--ink-2)',
                        }}
                      >
                        {cand.voteCount}
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${pct}%`, background: isLeader ? 'var(--seal)' : 'var(--ink-2)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '24px clamp(24px,5vw,64px)', fontSize: 13, color: 'var(--ink-2)' }}>
        Results are shown as they&apos;re recorded. No one, including the election&apos;s organizer, can see how any
        individual person voted.
      </footer>
    </>
  );
}
