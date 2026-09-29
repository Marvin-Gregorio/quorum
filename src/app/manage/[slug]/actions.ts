'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, candidateSchema, positionSchema } from '@/lib/validation';
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

  const { data: updatedRows, error } = await supabase
    .from('pages')
    .update({
      organization_name: sanitizeText(input.organizationName),
      title: sanitizeText(input.title),
      is_private: input.isPrivate,
      voting_starts_at: input.votingStartsAt,
      voting_ends_at: input.votingEndsAt,
    })
    .eq('id', pageId)
    .eq('owner_id', userData.user.id)
    .select('id');

  if (error || !updatedRows || updatedRows.length === 0) return { error: 'Could not save settings.' };

  await supabase.from('allowed_domains').delete().eq('page_id', pageId);
  if (input.isPrivate && input.domains.length > 0) {
    const { error: domainsError } = await supabase.from('allowed_domains').insert(
      input.domains.map((domain) => ({
        page_id: pageId,
        domain: sanitizeText(domain).toLowerCase().trim(),
      }))
    );
    if (domainsError) return { error: 'Settings were saved, but the allowed domains could not be updated.' };
  }

  return { ok: true };
}

export async function updateCandidatePhotoAction(
  candidateId: string,
  photoUrl: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .update({ photo_url: photoUrl })
    .eq('id', candidateId)
    .select('id');

  if (error || !data || data.length === 0) return { error: 'Could not save the candidate photo.' };
  return { ok: true };
}

export async function createCandidateAction(
  positionId: string,
  input: { name: string; bio: string }
): Promise<{ id: string } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .insert({ position_id: positionId, name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .select()
    .single();

  if (error || !data) return { error: 'Could not add the candidate. Positions may be locked once voting opens.' };
  return { id: data.id };
}

export async function updateCandidateAction(
  candidateId: string,
  input: { name: string; bio: string }
): Promise<{ ok: true } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .update({ name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .eq('id', candidateId)
    .select('id');

  if (error || !data || data.length === 0) return { error: 'Could not save the candidate.' };
  return { ok: true };
}

export async function deleteCandidateAction(candidateId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('candidates').delete().eq('id', candidateId).select('id');
  if (error || !data || data.length === 0) {
    return { error: 'Could not delete the candidate. Positions may be locked once voting opens.' };
  }
  return { ok: true };
}

export async function createPositionAction(
  pageId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  const result = positionSchema.safeParse({ title });
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from('positions')
    .select('id', { count: 'exact', head: true })
    .eq('page_id', pageId);

  const { data, error } = await supabase
    .from('positions')
    .insert({ page_id: pageId, title: sanitizeText(title), display_order: count ?? 0 })
    .select()
    .single();

  if (error || !data) return { error: 'Positions can only be added before voting opens.' };
  return { id: data.id };
}

export async function deletePositionAction(positionId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('positions').delete().eq('id', positionId).select('id');
  if (error || !data || data.length === 0) {
    return { error: 'Positions can only be removed before voting opens.' };
  }
  return { ok: true };
}
