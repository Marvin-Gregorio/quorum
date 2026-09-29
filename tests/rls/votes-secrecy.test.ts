import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('vote secrecy', () => {
  const service = createServiceRoleClient();
  let voterA: Awaited<ReturnType<typeof createClientAs>>;
  let voterB: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;
  let positionId: string;
  let candidateId: string;

  beforeAll(async () => {
    voterA = await createClientAs('voter-a@example.com');
    voterB = await createClientAs('voter-b@example.com');
    owner = await createClientAs('votes-secrecy-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'votes-secrecy-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Secrecy Test Election',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;

    const { data: position } = await service
      .from('positions')
      .insert({ page_id: pageId, title: 'Chair', display_order: 0 })
      .select()
      .single();
    positionId = position!.id;

    const { data: candidate } = await service
      .from('candidates')
      .insert({ position_id: positionId, name: 'Alex', bio: 'Bio' })
      .select()
      .single();
    candidateId = candidate!.id;

    await voterA.client.from('votes').insert({
      voter_id: voterA.userId,
      position_id: positionId,
      candidate_id: candidateId,
    });
  });

  afterAll(async () => {
    await service.from('pages').delete().eq('id', pageId);
  });

  it('lets a voter read their own vote', async () => {
    const { data, error } = await voterA.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId)
      .single();
    expect(error).toBeNull();
    expect(data?.candidate_id).toBe(candidateId);
  });

  it('never lets a different voter read that vote', async () => {
    const { data, error } = await voterB.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('never lets the page owner read that vote', async () => {
    const { data, error } = await owner.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets the owner see turnout without the candidate choice', async () => {
    const { data, error } = await owner.client
      .from('voter_turnout')
      .select('voter_id')
      .eq('position_id', positionId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].voter_id).toBe(voterA.userId);
  });
});
