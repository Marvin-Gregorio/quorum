import { describe, it, expect } from 'vitest';
import { getResultsSnapshot } from '@/lib/queries/results';

describe('getResultsSnapshot', () => {
  it('returns candidates with their current vote counts', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'pages') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'page-1', title: '2026 Board Election', organization_name: 'Riverside Tenants Cooperative' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'positions') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: 'pos-1', title: 'Board Chair', candidates: [{ id: 'cand-1', name: 'Dana Okafor' }] }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'vote_tallies') {
          return { select: () => ({ in: async () => ({ data: [{ position_id: 'pos-1', candidate_id: 'cand-1', vote_count: 61 }], error: null }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getResultsSnapshot(supabase, 'owner-1', 'test-election');
    expect(result?.positions[0].candidates[0].voteCount).toBe(61);
  });
});
