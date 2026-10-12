import { describe, it, expect, vi } from 'vitest';

const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const POSITION_ID = '11111111-1111-4111-8111-111111111111';

const state = { positions: [{ id: POSITION_ID, title: 'Board Chair' }] };

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

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPositionAction, deletePositionAction } from '@/app/manage/[ownerId]/[slug]/actions';

describe('position actions', () => {
  it('creates a position under a page', async () => {
    const result = await createPositionAction(PAGE_ID, 'Treasurer');
    expect('id' in result).toBe(true);
  });

  it('deletes a position', async () => {
    const result = await deletePositionAction(POSITION_ID);
    expect(result).toEqual({ ok: true });
    expect(state.positions.find((p) => p.id === POSITION_ID)).toBeUndefined();
  });

  it('rejects an empty position title', async () => {
    const result = await createPositionAction(PAGE_ID, '');
    expect('error' in result).toBe(true);
  });

  it('rejects non-UUID ids before creating a Supabase client', async () => {
    vi.mocked(createServerSupabaseClient).mockClear();
    expect('error' in (await deletePositionAction('pos-1'))).toBe(true);
    expect('error' in (await createPositionAction('page-1', 'Treasurer'))).toBe(true);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
