'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';

export interface PageSettingsInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
}

export async function updateElectionSettingsAction(
  pageId: string,
  input: PageSettingsInput
): Promise<{ ok: true } | { error: string }> {
  const result = pageSettingsSchema.safeParse(input);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in.' };

  const { error } = await supabase
    .from('pages')
    .update({
      organization_name: sanitizeText(input.organizationName),
      title: sanitizeText(input.title),
      is_private: input.isPrivate,
      voting_starts_at: input.votingStartsAt,
      voting_ends_at: input.votingEndsAt,
    })
    .eq('id', pageId)
    .eq('owner_id', userData.user.id);

  if (error) return { error: 'Could not save settings.' };

  await supabase.from('allowed_domains').delete().eq('page_id', pageId);
  if (input.isPrivate && input.domains.length > 0) {
    await supabase
      .from('allowed_domains')
      .insert(input.domains.map((domain) => ({ page_id: pageId, domain: sanitizeText(domain) })));
  }

  return { ok: true };
}
