import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('candidate-photos storage', () => {
  const service = createServiceRoleClient();
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let nonOwner: Awaited<ReturnType<typeof createClientAs>>;
  let pageId: string;
  let path: string;

  beforeAll(async () => {
    owner = await createClientAs('storage-photos-owner@example.com');
    nonOwner = await createClientAs('storage-photos-non-owner@example.com');

    const { data: page } = await service
      .from('pages')
      .insert({
        slug: 'storage-photos-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Storage Test Election',
        owner_id: owner.userId,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    pageId = page!.id;
    path = `${pageId}/candidate.webp`;
  });

  afterAll(async () => {
    await service.storage.from('candidate-photos').remove([path]);
    await service.from('pages').delete().eq('id', pageId);
  });

  const fakeImage = new Uint8Array([1, 2, 3, 4]);

  it('rejects an upload from a user who does not own the page', async () => {
    const { error } = await nonOwner.client.storage
      .from('candidate-photos')
      .upload(path, fakeImage, { contentType: 'image/webp' });
    expect(error).not.toBeNull();
  });

  it('allows an upload from the page owner', async () => {
    const { error } = await owner.client.storage
      .from('candidate-photos')
      .upload(path, fakeImage, { contentType: 'image/webp', upsert: true });
    expect(error).toBeNull();
  });
});
