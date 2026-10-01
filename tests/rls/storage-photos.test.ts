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

// Migration 0013 replaced the previously-unconditional public SELECT policy
// with one that respects page privacy — these cases didn't exist before and
// are the actual behavior change, not just "nothing broke."
describe('candidate-photos storage - read access reflects page privacy', () => {
  const service = createServiceRoleClient();
  let owner: Awaited<ReturnType<typeof createClientAs>>;
  let allowedDomainUser: Awaited<ReturnType<typeof createClientAs>>;
  let outsider: Awaited<ReturnType<typeof createClientAs>>;
  let privatePageId: string;
  let privatePath: string;
  let publicPageId: string;
  let publicPath: string;

  const fakeImage = new Uint8Array([1, 2, 3, 4]);

  beforeAll(async () => {
    owner = await createClientAs('storage-read-owner@example.com');
    allowedDomainUser = await createClientAs('member@storage-read-allowed.example');
    outsider = await createClientAs('storage-read-outsider@example.com');

    const { data: privatePage } = await service
      .from('pages')
      .insert({
        slug: 'storage-read-private-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Private Storage Read Test',
        owner_id: owner.userId,
        is_private: true,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    privatePageId = privatePage!.id;
    await service.from('allowed_domains').insert({ page_id: privatePageId, domain: 'storage-read-allowed.example' });

    privatePath = `${privatePageId}/candidate.webp`;
    await service.storage.from('candidate-photos').upload(privatePath, fakeImage, { contentType: 'image/webp' });

    const { data: publicPage } = await service
      .from('pages')
      .insert({
        slug: 'storage-read-public-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Public Storage Read Test',
        owner_id: owner.userId,
        is_private: false,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    publicPageId = publicPage!.id;
    publicPath = `${publicPageId}/candidate.webp`;
    await service.storage.from('candidate-photos').upload(publicPath, fakeImage, { contentType: 'image/webp' });
  });

  afterAll(async () => {
    await service.storage.from('candidate-photos').remove([privatePath, publicPath]);
    await service.from('pages').delete().in('id', [privatePageId, publicPageId]);
  });

  it('allows anyone to read a public page\'s candidate photo', async () => {
    const { error } = await outsider.client.storage.from('candidate-photos').download(publicPath);
    expect(error).toBeNull();
  });

  it('rejects reading a private page\'s candidate photo from a non-allowed-domain user', async () => {
    const { error } = await outsider.client.storage.from('candidate-photos').download(privatePath);
    expect(error).not.toBeNull();
  });

  it('allows reading a private page\'s candidate photo from an allowed-domain user', async () => {
    const { error } = await allowedDomainUser.client.storage.from('candidate-photos').download(privatePath);
    expect(error).toBeNull();
  });

  it('always allows the page owner to read their own private candidate photo', async () => {
    const { error } = await owner.client.storage.from('candidate-photos').download(privatePath);
    expect(error).toBeNull();
  });
});
