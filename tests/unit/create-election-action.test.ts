import { describe, it, expect, vi } from 'vitest';

const insertedRows: Record<string, any[]> = { pages: [], positions: [], candidates: [], allowed_domains: [] };

// The real action code awaits some inserts bare (allowed_domains, candidates)
// and chains .select().single() on others (pages, positions). This mock's
// insert() records the row immediately and returns an object that is BOTH
// chainable and directly awaitable (via .then), so either calling style
// works and is captured in insertedRows.
function makeInsertResult(table: string, row: any) {
  const rows = Array.isArray(row) ? row : [row];
  const withIds = rows.map((r) => ({ id: `${table}-${insertedRows[table].length + 1}`, ...r }));
  insertedRows[table].push(...withIds);
  return {
    select: () => ({ single: async () => ({ data: withIds[0], error: null }) }),
    then(resolve: (value: { data: any[]; error: null }) => void) {
      resolve({ data: withIds, error: null });
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: (row: any) => makeInsertResult(table, row),
    }),
  })),
}));

import { createElectionAction } from '@/app/create/actions';

describe('createElectionAction', () => {
  it('creates a page, its positions, and its candidates', async () => {
    const result = await createElectionAction({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
      positions: [
        {
          title: 'Board Chair',
          candidates: [{ name: 'Dana Okafor', bio: 'Eight years on the committee.' }],
        },
      ],
    });

    expect('slug' in result).toBe(true);
    expect(insertedRows.pages).toHaveLength(1);
    expect(insertedRows.positions).toHaveLength(1);
    expect(insertedRows.candidates).toHaveLength(1);
    expect(insertedRows.allowed_domains).toHaveLength(1);
  });

  it('rejects an empty election title', async () => {
    const result = await createElectionAction({
      organizationName: 'Riverside Tenants Cooperative',
      title: '',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
      positions: [],
    });
    expect('error' in result).toBe(true);
  });
});
