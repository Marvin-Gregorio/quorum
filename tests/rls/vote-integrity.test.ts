import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

// Regression coverage for the "ballot-stuffing via position_id swap" exploit:
// a voter casts a vote for candidate X in position A, then rewrites their own
// vote row's position_id to a throwaway position B. That frees up the
// (voter, position A) unique slot so they can vote for X in A again, and
// again, and again. Migration 0007 closes this with a composite FK
// (a vote's candidate must belong to the vote's position) and a trigger that
// forbids changing a vote row's position_id / voter_id.
describe('vote integrity', () => {
  const service = createServiceRoleClient();
  let voter: Awaited<ReturnType<typeof createClientAs>>;
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;
  let positionA: string;
  let positionB: string;
  let candidateX: string;
  let candidateY: string;
  let candidateInB: string;

  async function tallyFor(positionId: string, candidateId: string): Promise<number> {
    const { data } = await service
      .from('vote_tallies')
      .select('vote_count')
      .eq('position_id', positionId)
      .eq('candidate_id', candidateId)
      .maybeSingle();
    return data?.vote_count ?? 0;
  }

  beforeAll(async () => {
    voter = await createClientAs('vote-integrity-voter@example.com');
    owner = await createClientAs('vote-integrity-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'vote-integrity-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Integrity Test Election',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;

    const { data: positions } = await service
      .from('positions')
      .insert([
        { page_id: pageId, title: 'Chair', display_order: 0 },
        { page_id: pageId, title: 'Throwaway', display_order: 1 },
      ])
      .select();
    positionA = positions!.find((p) => p.title === 'Chair')!.id;
    positionB = positions!.find((p) => p.title === 'Throwaway')!.id;

    const { data: candidates } = await service
      .from('candidates')
      .insert([
        { position_id: positionA, name: 'X', bio: '' },
        { position_id: positionA, name: 'Y', bio: '' },
        { position_id: positionB, name: 'In B', bio: '' },
      ])
      .select();
    candidateX = candidates!.find((c) => c.name === 'X')!.id;
    candidateY = candidates!.find((c) => c.name === 'Y')!.id;
    candidateInB = candidates!.find((c) => c.name === 'In B')!.id;
  });

  afterAll(async () => {
    await service.from('votes').delete().eq('voter_id', voter.userId);
    await service.from('pages').delete().eq('id', pageId);
  });

  it('records a first vote and counts it in vote_tallies', async () => {
    const { error } = await voter.client
      .from('votes')
      .upsert(
        { voter_id: voter.userId, position_id: positionA, candidate_id: candidateX },
        { onConflict: 'voter_id,position_id' }
      );
    expect(error).toBeNull();
    expect(await tallyFor(positionA, candidateX)).toBe(1);
  });

  it('rejects moving an existing vote row to a different position (the original exploit)', async () => {
    const { error } = await voter.client
      .from('votes')
      .update({ position_id: positionB } as never)
      .eq('voter_id', voter.userId)
      .eq('position_id', positionA);
    expect(error).not.toBeNull();

    // The vote is still pinned to position A, so the (voter, A) slot is not
    // freed up for a second vote.
    const { data } = await service
      .from('votes')
      .select('position_id, candidate_id')
      .eq('voter_id', voter.userId);
    expect(data).toEqual([{ position_id: positionA, candidate_id: candidateX }]);

    const { error: secondVoteError } = await voter.client
      .from('votes')
      .insert({ voter_id: voter.userId, position_id: positionA, candidate_id: candidateX });
    expect(secondVoteError).not.toBeNull();
    expect(await tallyFor(positionA, candidateX)).toBe(1);
  });

  it('rejects an upsert that tries to repoint the vote at another position', async () => {
    const { data: existing } = await voter.client
      .from('votes')
      .select('id')
      .eq('position_id', positionA)
      .single();
    const { error } = await voter.client
      .from('votes')
      .upsert({ id: existing!.id, voter_id: voter.userId, position_id: positionB, candidate_id: candidateX } as never);
    expect(error).not.toBeNull();
  });

  it('rejects a vote whose candidate belongs to a different position', async () => {
    const { error } = await voter.client
      .from('votes')
      .insert({ voter_id: voter.userId, position_id: positionB, candidate_id: candidateX });
    expect(error).not.toBeNull();
    expect(await tallyFor(positionB, candidateX)).toBe(0);
  });

  it('rejects changing an existing vote to a candidate from a different position', async () => {
    const { error } = await voter.client
      .from('votes')
      .update({ candidate_id: candidateInB })
      .eq('voter_id', voter.userId)
      .eq('position_id', positionA);
    expect(error).not.toBeNull();
  });

  it('still lets a voter change their vote to another candidate in the same position', async () => {
    const { error } = await voter.client
      .from('votes')
      .upsert(
        { voter_id: voter.userId, position_id: positionA, candidate_id: candidateY },
        { onConflict: 'voter_id,position_id' }
      );
    expect(error).toBeNull();

    const { data } = await voter.client
      .from('votes')
      .select('candidate_id')
      .eq('position_id', positionA)
      .single();
    expect(data?.candidate_id).toBe(candidateY);

    // The tally moves from the old candidate to the new one.
    expect(await tallyFor(positionA, candidateX)).toBe(0);
    expect(await tallyFor(positionA, candidateY)).toBe(1);
  });

  it('does not double-count re-submitting the same choice', async () => {
    const { error } = await voter.client
      .from('votes')
      .upsert(
        { voter_id: voter.userId, position_id: positionA, candidate_id: candidateY },
        { onConflict: 'voter_id,position_id' }
      );
    expect(error).toBeNull();
    expect(await tallyFor(positionA, candidateX)).toBe(0);
    expect(await tallyFor(positionA, candidateY)).toBe(1);
  });
});
