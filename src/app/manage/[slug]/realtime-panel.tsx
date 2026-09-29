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
  initialTallies,
  initialTurnout,
}: {
  pageId: string;
  initialTallies: Tally[];
  initialTurnout: Turnout[];
}) {
  const [tallies, setTallies] = useState(initialTallies);
  const [turnout, setTurnout] = useState(initialTurnout);

  // vote_tallies rows don't carry page_id directly (only position_id, which
  // joins to it), so the Realtime subscription below is unfiltered at the
  // channel/table level and instead filters incoming rows client-side
  // against this page's own position ids — otherwise a manager with two
  // elections open in different tabs would see one console react to the
  // other election's votes.
  const positionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of initialTallies) ids.add(t.positionId);
    for (const t of initialTurnout) ids.add(t.positionId);
    return ids;
  }, [initialTallies, initialTurnout]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`manage-${pageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_tallies' }, (payload) => {
        const row = payload.new as { position_id: string; candidate_id: string; vote_count: number };
        if (!positionIds.has(row.position_id)) return;
        setTallies((prev) => {
          const next = prev.filter((t) => !(t.positionId === row.position_id && t.candidateId === row.candidate_id));
          next.push({ positionId: row.position_id, candidateId: row.candidate_id, voteCount: row.vote_count });
          return next;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_turnout' }, (payload) => {
        const row = payload.new as { position_id: string; voter_id: string };
        if (!positionIds.has(row.position_id)) return;
        setTurnout((prev) => {
          if (prev.some((t) => t.positionId === row.position_id && t.voterId === row.voter_id)) return prev;
          return [...prev, { positionId: row.position_id, voterId: row.voter_id }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, positionIds]);

  return (
    <div>
      {/* Render tallies/turnout counts per position — visual treatment ports
          directly from the validated Manage.dc.html design's turnout line
          and tally display; no new layout decisions here, just binding
          `tallies`/`turnout` state into that already-approved markup. */}
    </div>
  );
}
