import { describe, it, expect } from 'vitest';
import { getManagedElections } from '@/lib/queries/profile';

describe('getManagedElections', () => {
  it('marks a page whose window has passed as closed', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: 'page-1',
                  slug: 'community-garden',
                  title: 'Community Garden Committee',
                  organization_name: 'Riverside Tenants Cooperative',
                  voting_starts_at: '2020-01-01T00:00:00.000Z',
                  voting_ends_at: '2020-01-08T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as any;

    const result = await getManagedElections(supabase, 'owner-1');
    expect(result[0].status).toBe('closed');
  });
});
