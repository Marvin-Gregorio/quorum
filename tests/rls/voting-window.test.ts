import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('voting window', () => {
  const service = createServiceRoleClient();
  let voter: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let notYetOpenPageId: string;
  let notYetOpenPositionId: string;
  let notYetOpenCandidateId: string;
  let closedPageId: string;
  let closedPositionId: string;
  let closedCandidateId: string;

  beforeAll(async () => {
    voter = await createClientAs('voting-window-voter@example.com');
    owner = await createClientAs('voting-window-owner@example.com');

    const { data: futurePage } = await service
      .from('pages')
      .insert({
        slug: 'voting-window-future-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Not Open Yet',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    notYetOpenPageId = futurePage!.id;

    const { data: futurePosition } = await service
      .from('positions')
      .insert({ page_id: notYetOpenPageId, title: 'Chair', display_order: 0 })
      .select()
      .single();
    notYetOpenPositionId = futurePosition!.id;

    const { data: futureCandidate } = await service
      .from('candidates')
      .insert({ position_id: notYetOpenPositionId, name: 'X', bio: '' })
      .select()
      .single();
    notYetOpenCandidateId = futureCandidate!.id;

    const { data: pastPage } = await service
      .from('pages')
      .insert({
        slug: 'voting-window-closed-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Already Closed',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() - 7_200_000).toISOString(),
        voting_ends_at: new Date(Date.now() - 3_600_000).toISOString(),
      })
      .select()
      .single();
    closedPageId = pastPage!.id;

    const { data: closedPosition } = await service
      .from('positions')
      .insert({ page_id: closedPageId, title: 'Chair', display_order: 0 })
      .select()
      .single();
    closedPositionId = closedPosition!.id;

    const { data: closedCandidate } = await service
      .from('candidates')
      .insert({ position_id: closedPositionId, name: 'X', bio: '' })
      .select()
      .single();
    closedCandidateId = closedCandidate!.id;
  });

  afterAll(async () => {
    await service.from('pages').delete().in('id', [notYetOpenPageId, closedPageId]);
  });

  it('rejects a vote cast before voting opens', async () => {
    const { error } = await voter.client.from('votes').insert({
      voter_id: voter.userId,
      position_id: notYetOpenPositionId,
      candidate_id: notYetOpenCandidateId,
    });
    expect(error).not.toBeNull();

    const { data } = await service.from('votes').select('id').eq('position_id', notYetOpenPositionId);
    expect(data).toEqual([]);
  });

  it('rejects a vote cast after voting has closed', async () => {
    const { error } = await voter.client.from('votes').insert({
      voter_id: voter.userId,
      position_id: closedPositionId,
      candidate_id: closedCandidateId,
    });
    expect(error).not.toBeNull();

    const { data } = await service.from('votes').select('id').eq('position_id', closedPositionId);
    expect(data).toEqual([]);
  });
});
