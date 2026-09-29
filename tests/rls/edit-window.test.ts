import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClientAs, createServiceRoleClient } from './setup';

describe('structural edit window', () => {
  let ownerClient: Awaited<ReturnType<typeof createClientAs>>;
  let openPageId: string;
  let notYetOpenPageId: string;
  const service = createServiceRoleClient();

  beforeAll(async () => {
    ownerClient = await createClientAs('edit-window-owner@example.com');

    const { data: openPage } = await service
      .from('pages')
      .insert({
        slug: 'edit-window-open-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Already Open',
        owner_id: ownerClient.userId,
        voting_starts_at: new Date(Date.now() - 60_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select()
      .single();
    openPageId = openPage!.id;

    const { data: futurePage } = await service
      .from('pages')
      .insert({
        slug: 'edit-window-future-' + Date.now(),
        organization_name: 'Test Org',
        title: 'Not Open Yet',
        owner_id: ownerClient.userId,
        voting_starts_at: new Date(Date.now() + 3_600_000).toISOString(),
        voting_ends_at: new Date(Date.now() + 7_200_000).toISOString(),
      })
      .select()
      .single();
    notYetOpenPageId = futurePage!.id;
  });

  afterAll(async () => {
    await service.from('pages').delete().in('id', [openPageId, notYetOpenPageId]);
  });

  it('rejects inserting a position once voting has opened', async () => {
    const { error } = await ownerClient.client
      .from('positions')
      .insert({ page_id: openPageId, title: 'Late Position', display_order: 0 });
    expect(error).not.toBeNull();
  });

  it('allows inserting a position before voting opens', async () => {
    const { data, error } = await ownerClient.client
      .from('positions')
      .insert({ page_id: notYetOpenPageId, title: 'Early Position', display_order: 0 })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.title).toBe('Early Position');
  });
});
