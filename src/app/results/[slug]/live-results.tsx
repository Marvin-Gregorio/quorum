'use client';

import { useEffect, useState } from 'react';
import type { ResultsSnapshot } from '@/lib/queries/results';

export function LiveResults({ slug, initialSnapshot }: { slug: string; initialSnapshot: ResultsSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/results/${slug}`);
      if (response.ok) setSnapshot(await response.json());
    }, 6000);
    return () => clearInterval(interval);
  }, [slug]);

  return (
    <div>
      <h1>{snapshot.title}</h1>
      <p>{snapshot.organizationName}</p>
      {/* Per-position candidate bars port directly from the validated
          Results.dc.html design; snapshot.positions[].candidates[].voteCount
          drives each bar's width exactly as that design computed it. */}
    </div>
  );
}
