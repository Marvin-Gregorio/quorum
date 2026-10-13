import { describe, it, expect, vi } from 'vitest';

// Computed relative to "now" (rather than hardcoded past dates) so this test
// doesn't drift into the past and start tripping createElectionAction's
// "voting must start in the future" validation as real time passes.
const FUTURE_STARTS_AT = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const FUTURE_ENDS_AT = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

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
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
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
      votingStartsAt: FUTURE_STARTS_AT,
      votingEndsAt: FUTURE_ENDS_AT,
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
      votingStartsAt: FUTURE_STARTS_AT,
      votingEndsAt: FUTURE_ENDS_AT,
      isPrivate: false,
      domains: [],
      positions: [],
    });
    expect('error' in result).toBe(true);
  });

  const valid = {
    organizationName: 'Riverside Tenants Cooperative',
    title: '2026 Board Election',
    votingStartsAt: FUTURE_STARTS_AT,
    votingEndsAt: FUTURE_ENDS_AT,
    isPrivate: false,
    domains: [],
    positions: [{ title: 'Board Chair', candidates: [{ name: 'Dana Okafor', bio: '' }] }],
  };

  it.each([
    ['positions that are not an array', { ...valid, positions: 'x' }],
    ['a missing positions field', { ...valid, positions: undefined }],
    ['an invalid allowed domain', { ...valid, isPrivate: true, domains: ['foo bar'] }],
    ['no positions', { ...valid, positions: [] }],
    ['a position with no candidates', { ...valid, positions: [{ title: 'Chair', candidates: [] }] }],
    ['an empty candidate name', { ...valid, positions: [{ title: 'Chair', candidates: [{ name: '', bio: '' }] }] }],
    ['no payload at all', undefined],
  ])('returns an error, not a throw, for %s', async (_label, payload) => {
    const before = insertedRows.pages.length;
    const result = await createElectionAction(payload as never);
    expect('error' in result).toBe(true);
    expect(insertedRows.pages).toHaveLength(before);
  });

  it('rejects a title that is only HTML tags before inserting anything', async () => {
    const before = insertedRows.pages.length;
    const result = await createElectionAction({ ...valid, title: '<b></b>' });
    expect(result).toEqual({ error: 'Names and titles cannot be empty once HTML tags are removed.' });
    expect(insertedRows.pages).toHaveLength(before);
  });

  it('echoes the sanitized (not raw) names back to the client', async () => {
    const result = await createElectionAction({
      ...valid,
      positions: [{ title: '<i>Chair</i>', candidates: [{ name: '<b>Dana</b>', bio: '' }] }],
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.positions[0].title).toBe('Chair');
    expect(result.positions[0].candidates[0].name).toBe('Dana');
  });
});
