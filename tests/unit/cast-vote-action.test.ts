import { describe, it, expect, vi } from 'vitest';

const upserts: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'voter-1' } } }) },
    from: () => ({
      upsert: (row: any, opts: any) => {
        upserts.push({ row, opts });
        return Promise.resolve({ error: null });
      },
    }),
  })),
}));

import { castVoteAction } from '@/app/vote/[slug]/actions';

describe('castVoteAction', () => {
  it('upserts on (voter_id, position_id) so a resubmission changes the vote', async () => {
    const result = await castVoteAction('pos-1', 'cand-2');
    expect(result).toEqual({ ok: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toEqual({ voter_id: 'voter-1', position_id: 'pos-1', candidate_id: 'cand-2' });
    expect(upserts[0].opts).toEqual({ onConflict: 'voter_id,position_id' });
  });
});
