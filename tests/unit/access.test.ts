import { describe, it, expect } from 'vitest';
import { checkPageAccess } from '@/lib/access';

function fakeSupabase(matches: boolean) {
  return {
    rpc: async () => ({ data: matches, error: null }),
  } as any;
}

describe('checkPageAccess', () => {
  const publicPage = { id: 'page-1', is_private: false, owner_id: 'owner-1' };
  const privatePage = { id: 'page-2', is_private: true, owner_id: 'owner-1' };

  it('requires sign-in on a public page when there is no user', async () => {
    const result = await checkPageAccess(fakeSupabase(false), publicPage, null, null);
    expect(result).toBe('sign-in');
  });

  it('allows any signed-in user on a public page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), publicPage, 'voter-1', 'voter@anywhere.com');
    expect(result).toBe('ok');
  });

  it('always allows the owner on their own private page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), privatePage, 'owner-1', 'owner@example.com');
    expect(result).toBe('ok');
  });

  it('allows a matching-domain user on a private page', async () => {
    const result = await checkPageAccess(fakeSupabase(true), privatePage, 'voter-1', 'voter@insider.com');
    expect(result).toBe('ok');
  });

  it('restricts a non-matching-domain user on a private page', async () => {
    const result = await checkPageAccess(fakeSupabase(false), privatePage, 'voter-1', 'voter@outsider.com');
    expect(result).toBe('restricted');
  });
});
