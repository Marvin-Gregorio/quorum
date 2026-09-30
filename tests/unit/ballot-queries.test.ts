import { describe, it, expect } from 'vitest';
import { getBallot } from '@/services/ballot';

describe('getBallot', () => {
  it('marks the voter\'s prior choice as selected', async () => {
    const supabase = {
      from: (table: string) => {
        if (table === 'pages') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'page-1',
                      title: '2026 Board Election',
                      organization_name: 'Riverside Tenants Cooperative',
                      voting_ends_at: '2026-03-14T17:00:00.000Z',
                    },
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
                  data: [
                    {
                      id: 'pos-1',
                      title: 'Board Chair',
                      candidates: [
                        { id: 'cand-1', name: 'Dana Okafor', bio: 'Bio', photo_url: null },
                        { id: 'cand-2', name: 'Marcus Whitfield', bio: 'Bio', photo_url: null },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ position_id: 'pos-1', candidate_id: 'cand-2' }], error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getBallot(supabase, 'owner-1', 'test-election', 'voter-1');
    expect(result?.positions[0].selectedCandidateId).toBe('cand-2');
  });
});
