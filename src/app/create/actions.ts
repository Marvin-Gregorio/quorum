'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';
import { generateUniqueSlug } from '@/lib/slug';

export interface CreateElectionInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
  positions: { title: string; candidates: { name: string; bio: string }[] }[];
}

export async function createElectionAction(
  input: CreateElectionInput
): Promise<{ slug: string } | { error: string }> {
  const settingsResult = pageSettingsSchema.safeParse(input);
  if (!settingsResult.success) {
    return { error: settingsResult.error.issues[0].message };
  }

  for (const position of input.positions) {
    const positionResult = positionSchema.safeParse(position);
    if (!positionResult.success) {
      return { error: positionResult.error.issues[0].message };
    }
    for (const candidate of position.candidates) {
      const candidateResult = candidateSchema.safeParse(candidate);
      if (!candidateResult.success) {
        return { error: candidateResult.error.issues[0].message };
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'You must be signed in to create an election.' };
  }

  const slug = await generateUniqueSlug(supabase, input.title);

  const { data: page, error: pageError } = await supabase
    .from('pages')
    .insert({
      slug,
      organization_name: sanitizeText(input.organizationName),
      title: sanitizeText(input.title),
      owner_id: userData.user.id,
      is_private: input.isPrivate,
      voting_starts_at: input.votingStartsAt,
      voting_ends_at: input.votingEndsAt,
    })
    .select()
    .single();

  if (pageError || !page) {
    return { error: 'Could not create the election. Please try again.' };
  }

  if (input.isPrivate && input.domains.length > 0) {
    await supabase
      .from('allowed_domains')
      .insert(input.domains.map((domain) => ({ page_id: page.id, domain: sanitizeText(domain) })));
  }

  for (const [index, position] of input.positions.entries()) {
    const { data: createdPosition } = await supabase
      .from('positions')
      .insert({ page_id: page.id, title: sanitizeText(position.title), display_order: index })
      .select()
      .single();

    if (createdPosition) {
      for (const candidate of position.candidates) {
        await supabase.from('candidates').insert({
          position_id: createdPosition.id,
          name: sanitizeText(candidate.name),
          bio: sanitizeText(candidate.bio),
        });
      }
    }
  }

  return { slug: page.slug };
}
