'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export interface Tally {
  positionId: string;
  candidateId: string;
  voteCount: number;
}

/**
 * Keeps a page's `vote_tallies` rows live via Supabase Realtime. Used by
 * both the Manager Console (always) and the public Results page (only when
 * the viewer is the election's owner) — everyone else stays on polling, to
 * protect the free-tier ~200 concurrent Realtime connection budget.
 *
 * `enabled: false` is a full no-op (no subscription opened), so a caller can
 * keep the hook unconditionally called while still gating the actual work.
 */
export function useLiveVoteTallies({
  pageId,
  positionIds,
  initialTallies,
  enabled,
}: {
  pageId: string;
  positionIds: string[];
  initialTallies: Tally[];
  enabled: boolean;
}): Tally[] {
  const [tallies, setTallies] = useState(initialTallies);

  // Re-checked client-side against this same position id set as a
  // defence-in-depth belt-and-braces check (and to guard against a
  // stale/empty positionIds prop on first render).
  const positionIdSet = useMemo(() => new Set(positionIds), [positionIds]);

  useEffect(() => {
    if (!enabled || positionIds.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const positionIdFilter = `position_id=in.(${positionIds.join(',')})`;
    const channel = supabase
      .channel(`tallies-${pageId}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, pageId, positionIds, positionIdSet]);

  return tallies;
}
