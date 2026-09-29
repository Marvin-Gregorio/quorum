import { describe, it, expect, vi } from 'vitest';

const state = { candidates: [{ id: 'cand-1', name: 'Old Name', bio: 'Old bio' }] };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== 'candidates') throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              const created = { id: 'cand-new', ...row };
              state.candidates.push(created);
              return { data: created, error: null };
            },
          }),
        }),
        update: (row: any) => ({
          eq: async (_col: string, id: string) => {
            const found = state.candidates.find((c) => c.id === id);
            if (found) Object.assign(found, row);
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (_col: string, id: string) => {
            state.candidates = state.candidates.filter((c) => c.id !== id);
            return { error: null };
          },
        }),
      };
    },
  })),
}));

import { createCandidateAction, updateCandidateAction, deleteCandidateAction } from '@/app/manage/[slug]/actions';

describe('candidate actions', () => {
  it('creates a candidate under a position', async () => {
    const result = await createCandidateAction('pos-1', { name: 'Marcus Whitfield', bio: 'New to the board.' });
    expect('id' in result).toBe(true);
  });

  it('updates an existing candidate', async () => {
    const result = await updateCandidateAction('cand-1', { name: 'New Name', bio: 'New bio' });
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === 'cand-1')?.name).toBe('New Name');
  });

  it('deletes a candidate', async () => {
    const result = await deleteCandidateAction('cand-1');
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === 'cand-1')).toBeUndefined();
  });

  it('rejects an empty candidate name', async () => {
    const result = await createCandidateAction('pos-1', { name: '', bio: 'Bio' });
    expect('error' in result).toBe(true);
  });
});
