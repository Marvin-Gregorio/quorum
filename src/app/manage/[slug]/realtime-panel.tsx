'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export interface Tally {
  positionId: string;
  candidateId: string;
  voteCount: number;
}

export interface Turnout {
  positionId: string;
  voterId: string;
}

export function RealtimePanel({
  pageId,
  positionIds,
  initialTallies,
  initialTurnout,
}: {
  pageId: string;
  positionIds: string[];
  initialTallies: Tally[];
  initialTurnout: Turnout[];
}) {
  const [tallies, setTallies] = useState(initialTallies);
  const [turnout, setTurnout] = useState(initialTurnout);

  // vote_tallies rows don't carry page_id directly (only position_id), so
  // the Realtime subscription is filtered server-side with an `in.(...)`
  // filter over this page's own position ids. voter_turnout does carry
  // page_id directly, so it's filtered server-side on that column instead.
  // Both are still re-checked client-side against this same position id set
  // as a defence-in-depth belt-and-braces check (and to guard against a
  // stale/empty positionIds prop on first render). This set comes from the
  // page's full, server-fetched position list (not derived from
  // initialTallies/initialTurnout), so a position with zero votes/turnout so
  // far — newly added, or just hasn't received its first vote yet — is
  // still included and its first live vote isn't silently dropped.
  const positionIdSet = useMemo(() => new Set(positionIds), [positionIds]);

  useEffect(() => {
    if (positionIds.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const positionIdFilter = `position_id=in.(${positionIds.join(',')})`;
    const channel = supabase
      .channel(`manage-${pageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vote_tallies', filter: positionIdFilter },
        (payload) => {
          const row = payload.new as { position_id: string; candidate_id: string; vote_count: number };
          if (!positionIdSet.has(row.position_id)) return;
          setTallies((prev) => {
            const next = prev.filter((t) => !(t.positionId === row.position_id && t.candidateId === row.candidate_id));
            next.push({ positionId: row.position_id, candidateId: row.candidate_id, voteCount: row.vote_count });
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voter_turnout', filter: `page_id=eq.${pageId}` },
        (payload) => {
          const row = payload.new as { position_id: string; voter_id: string };
          if (!positionIdSet.has(row.position_id)) return;
          setTurnout((prev) => {
            if (prev.some((t) => t.positionId === row.position_id && t.voterId === row.voter_id)) return prev;
            return [...prev, { positionId: row.position_id, voterId: row.voter_id }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, positionIds, positionIdSet]);

  return (
    <div>
      {/* TODO: rendering tallies/turnout counts per position is not built
          yet. `tallies`/`turnout` state above is kept live via the Realtime
          subscription, but nothing here reads it into markup. */}
    </div>
  );
}
