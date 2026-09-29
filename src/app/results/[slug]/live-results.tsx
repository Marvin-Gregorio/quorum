'use client';

import { useEffect, useState } from 'react';
import type { ResultsSnapshot } from '@/lib/queries/results';

export function LiveResults({ slug, initialSnapshot }: { slug: string; initialSnapshot: ResultsSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip polling while the tab isn't visible, so results don't keep
      // fetching forever in a backgrounded tab.
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/results/${slug}`);
        if (response.ok) setSnapshot(await response.json());
      } catch {
        // A transient network failure shouldn't crash the poll loop or
        // produce an unhandled rejection; just try again next tick.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [slug]);

  return (
    <div>
      <h1>{snapshot.title}</h1>
      <p>{snapshot.organizationName}</p>
      {/* TODO: the per-position candidate bars are not built yet.
          snapshot.positions[].candidates[].voteCount is fetched and kept
          live via polling above, but nothing renders it. */}
    </div>
  );
}
