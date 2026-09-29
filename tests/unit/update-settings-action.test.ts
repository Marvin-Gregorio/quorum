import { describe, it, expect, vi } from 'vitest';

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

import { updateElectionSettingsAction } from '@/app/manage/[slug]/actions';

describe('updateElectionSettingsAction', () => {
  it('updates the page and replaces its allowed domains', async () => {
    const result = await updateElectionSettingsAction('page-1', {
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
    expect(deletedDomainsFor).toEqual(['page-1']);
    expect(insertedDomains).toEqual([{ page_id: 'page-1', domain: 'riverside.coop' }]);
  });

  it('rejects an invalid settings payload', async () => {
    const result = await updateElectionSettingsAction('page-1', {
      organizationName: '',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect('error' in result).toBe(true);
  });
});
