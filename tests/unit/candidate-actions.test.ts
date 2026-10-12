import { describe, it, expect, vi } from 'vitest';

const POSITION_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';

const state = { candidates: [{ id: CANDIDATE_ID, name: 'Old Name', bio: 'Old bio' }] };

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
          eq: (_col: string, id: string) => ({
            select: async (_col2: string) => {
              const found = state.candidates.find((c) => c.id === id);
              if (found) Object.assign(found, row);
              return { data: found ? [{ id: found.id }] : [], error: null };
            },
          }),
        }),
        delete: () => ({
          eq: (_col: string, id: string) => ({
            select: async (_col2: string) => {
              const existed = state.candidates.some((c) => c.id === id);
              state.candidates = state.candidates.filter((c) => c.id !== id);
              return { data: existed ? [{ id }] : [], error: null };
            },
          }),
        }),
      };
    },
  })),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createCandidateAction, updateCandidateAction, deleteCandidateAction } from '@/app/manage/[ownerId]/[slug]/actions';

describe('candidate actions', () => {
  it('creates a candidate under a position', async () => {
    const result = await createCandidateAction(POSITION_ID, { name: 'Marcus Whitfield', bio: 'New to the board.' });
    expect('id' in result).toBe(true);
  });

  it('updates an existing candidate', async () => {
    const result = await updateCandidateAction(CANDIDATE_ID, { name: 'New Name', bio: 'New bio' });
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === CANDIDATE_ID)?.name).toBe('New Name');
  });

  it('deletes a candidate', async () => {
    const result = await deleteCandidateAction(CANDIDATE_ID);
    expect(result).toEqual({ ok: true });
    expect(state.candidates.find((c) => c.id === CANDIDATE_ID)).toBeUndefined();
  });

  it('rejects an empty candidate name', async () => {
    const result = await createCandidateAction(POSITION_ID, { name: '', bio: 'Bio' });
    expect('error' in result).toBe(true);
  });

  describe('rejects bad input before creating a Supabase client', () => {
    it.each([
      ['a non-UUID candidate id on delete', () => deleteCandidateAction('cand-1')],
      ['a non-UUID candidate id on update', () => updateCandidateAction('cand-1', { name: 'A', bio: '' })],
      ['a non-UUID position id on create', () => createCandidateAction('pos-1', { name: 'A', bio: '' })],
      ['an over-long name', () => updateCandidateAction(CANDIDATE_ID, { name: 'x'.repeat(101), bio: '' })],
      ['a missing payload', () => updateCandidateAction(CANDIDATE_ID, undefined as never)],
    ])('%s', async (_label, call) => {
      vi.mocked(createServerSupabaseClient).mockClear();
      const result = await call();
      expect('error' in result).toBe(true);
      expect(createServerSupabaseClient).not.toHaveBeenCalled();
    });
  });

  it('rejects a name that is only HTML tags once sanitized', async () => {
    const result = await createCandidateAction(POSITION_ID, { name: '<b></b>', bio: '' });
    expect(result).toEqual({ error: 'Names and titles cannot be empty once HTML tags are removed.' });
  });
});
