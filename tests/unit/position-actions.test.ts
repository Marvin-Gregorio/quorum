import { describe, it, expect, vi } from 'vitest';

const state = { positions: [{ id: 'pos-1', title: 'Board Chair' }] };

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== 'positions') throw new Error(`unexpected table ${table}`);
      return {
        select: (_col: string, _opts?: any) => ({
          eq: async (_col2: string, _pageId: string) => ({ count: state.positions.length, error: null }),
        }),
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              const created = { id: 'pos-new', ...row };
              state.positions.push(created);
              return { data: created, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: (_col: string, id: string) => ({
            select: async (_col2: string) => {
              const existed = state.positions.some((p) => p.id === id);
              state.positions = state.positions.filter((p) => p.id !== id);
              return { data: existed ? [{ id }] : [], error: null };
            },
          }),
        }),
      };
    },
  })),
}));

import { createPositionAction, deletePositionAction } from '@/app/manage/[slug]/actions';

describe('position actions', () => {
  it('creates a position under a page', async () => {
    const result = await createPositionAction('page-1', 'Treasurer');
    expect('id' in result).toBe(true);
  });

  it('deletes a position', async () => {
    const result = await deletePositionAction('pos-1');
    expect(result).toEqual({ ok: true });
    expect(state.positions.find((p) => p.id === 'pos-1')).toBeUndefined();
  });

  it('rejects an empty position title', async () => {
    const result = await createPositionAction('page-1', '');
    expect('error' in result).toBe(true);
  });
});
