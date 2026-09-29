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

const POSITION_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';

describe('castVoteAction', () => {
  it('upserts on (voter_id, position_id) so a resubmission changes the vote', async () => {
    const result = await castVoteAction(POSITION_ID, CANDIDATE_ID);
    expect(result).toEqual({ ok: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row).toEqual({ voter_id: 'voter-1', position_id: POSITION_ID, candidate_id: CANDIDATE_ID });
    expect(upserts[0].opts).toEqual({ onConflict: 'voter_id,position_id' });
  });

  it('rejects a missing or malformed candidate/position id before touching the database', async () => {
    const before = upserts.length;
    const result = await castVoteAction(POSITION_ID, '');
    expect(result).toEqual({ error: 'Please select a candidate before casting your vote.' });
    expect(upserts).toHaveLength(before);
  });
});
