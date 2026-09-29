import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('domain gating on a private page', () => {
  const service = createServiceRoleClient();
  let insider: Awaited<ReturnType<typeof createClientAs>>;
  let outsider: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;
  let positionId: string;
  let candidateId: string;

  beforeAll(async () => {
    insider = await createClientAs('person@insider-domain.example.com');
    outsider = await createClientAs('person@outsider-domain.example.com');
    owner = await createClientAs('domain-gating-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'domain-gating-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Private Election',
        owner_id: owner.userId,
        is_private: true,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;

    await service.from('allowed_domains').insert({ page_id: pageId, domain: 'insider-domain.example.com' });

    const { data: position } = await service
      .from('positions')
      .insert({ page_id: pageId, title: 'Chair', display_order: 0 })
      .select()
      .single();
    positionId = position!.id;

    const { data: candidate } = await service
      .from('candidates')
      .insert({ position_id: positionId, name: 'X', bio: '' })
      .select()
      .single();
    candidateId = candidate!.id;
  });

  afterAll(async () => {
    await service.from('pages').delete().eq('id', pageId);
  });

  it('lets a matching-domain user read the private page', async () => {
    const { data, error } = await insider.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('hides the private page from a non-matching-domain user', async () => {
    const { data, error } = await outsider.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('always lets the owner read their own private page', async () => {
    const { data, error } = await owner.client.from('pages').select('id').eq('id', pageId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('rejects a vote from a non-matching-domain user on a private page', async () => {
    const { error } = await outsider.client.from('votes').insert({
      voter_id: outsider.userId,
      position_id: positionId,
      candidate_id: candidateId,
    });
    expect(error).not.toBeNull();

    const { data } = await service.from('votes').select('id').eq('voter_id', outsider.userId);
    expect(data).toEqual([]);
  });

  it('allows a vote from a matching-domain user on a private page', async () => {
    const { error } = await insider.client.from('votes').insert({
      voter_id: insider.userId,
      position_id: positionId,
      candidate_id: candidateId,
    });
    expect(error).toBeNull();
  });
});
