import { describe, it, expect, vi } from 'vitest';

const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const updates: any[] = [];
const deletedDomainsFor: string[] = [];
const insertedDomains: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (table: string) => {
      if (table === 'pages') {
        return {
          update: (row: any) => ({
            eq: (_col: string, id: string) => ({
              eq: (_col2: string, ownerId: string) => ({
                select: (_col3: string) => {
                  updates.push({ id, ownerId, row });
                  return Promise.resolve({ data: [{ id }], error: null });
                },
              }),
            }),
          }),
        };
      }
      if (table === 'allowed_domains') {
        return {
          delete: () => ({ eq: (_col: string, pageId: string) => { deletedDomainsFor.push(pageId); return Promise.resolve({ error: null }); } }),
          insert: (rows: any[]) => { insertedDomains.push(...rows); return Promise.resolve({ error: null }); },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));

import { updateElectionSettingsAction } from '@/app/manage/[ownerId]/[slug]/actions';

describe('updateElectionSettingsAction', () => {
  it('updates the page and replaces its allowed domains', async () => {
    const result = await updateElectionSettingsAction(PAGE_ID, {
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
    });

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].ownerId).toBe('owner-1');
    expect(deletedDomainsFor).toEqual([PAGE_ID]);
    expect(insertedDomains).toEqual([{ page_id: PAGE_ID, domain: 'riverside.coop' }]);
  });

  it('rejects an invalid settings payload', async () => {
    const result = await updateElectionSettingsAction(PAGE_ID, {
      organizationName: '',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect('error' in result).toBe(true);
  });

  it('rejects a non-UUID page id before touching the database', async () => {
    const before = updates.length;
    const result = await updateElectionSettingsAction('page-1', {
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect('error' in result).toBe(true);
    expect(updates).toHaveLength(before);
  });

  it('rejects a malformed allowed domain', async () => {
    const before = updates.length;
    const result = await updateElectionSettingsAction(PAGE_ID, {
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['foo bar'],
    });
    expect(result).toEqual({ error: 'Allowed domains must look like "example.com".' });
    expect(updates).toHaveLength(before);
  });
});
