import { describe, it, expect } from 'vitest';
import { getManagedElection } from '@/services/manage';

describe('getManagedElection', () => {
  it('returns null when no page matches the slug', async () => {
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
    } as any;
    const result = await getManagedElection(supabase, 'owner-1', 'does-not-exist');
    expect(result).toBeNull();
  });

  it('maps a found page into the ManagedElection shape', async () => {
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
                      slug: 'test-election',
                      organization_name: 'Test Org',
                      title: 'Test Election',
                      is_private: true,
                      voting_starts_at: '2026-02-28T09:00:00.000Z',
                      voting_ends_at: '2026-03-14T17:00:00.000Z',
                      owner_id: 'owner-1',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'allowed_domains') {
          return { select: () => ({ eq: async () => ({ data: [{ domain: 'riverside.coop' }], error: null }) }) };
        }
        if (table === 'positions') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: 'pos-1', title: 'Board Chair', candidates: [{ id: 'cand-1', name: 'Dana Okafor', bio: 'Bio', photo_url: null }] }],
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await getManagedElection(supabase, 'owner-1', 'test-election');
    expect(result?.organizationName).toBe('Test Org');
    expect(result?.domains).toEqual(['riverside.coop']);
    expect(result?.positions[0].candidates[0].name).toBe('Dana Okafor');
  });
});
