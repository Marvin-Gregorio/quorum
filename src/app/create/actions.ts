'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';
import { generateUniqueSlug, nextSlugAttempt, slugify } from '@/lib/slug';

const MAX_SLUG_INSERT_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

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

  if (new Date(input.votingStartsAt).getTime() <= Date.now()) {
    return { error: 'Voting must start in the future.' };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'You must be signed in to create an election.' };
  }

  const baseSlug = slugify(input.title) || undefined;
  let slug = await generateUniqueSlug(supabase, input.title);
  let page: { id: string; slug: string } | null = null;

  // The pre-check inside generateUniqueSlug only sees pages visible to this
  // user under RLS, so it can't detect a collision with another user's
  // invisible private page. Retry with an incremented suffix on an actual
  // unique-constraint violation from the insert itself, rather than trusting
  // the pre-check alone (which would otherwise fail forever with the same
  // regenerated slug).
  for (let attempt = 0; attempt < MAX_SLUG_INSERT_ATTEMPTS; attempt += 1) {
    const { data, error: pageError } = await supabase
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

    if (!pageError && data) {
      page = data;
      break;
    }

    if (pageError?.code === POSTGRES_UNIQUE_VIOLATION && baseSlug) {
      slug = nextSlugAttempt(baseSlug, slug);
      continue;
    }

    return { error: 'Could not create the election. Please try again.' };
  }

  if (!page) {
    return { error: 'Could not create the election. Please try again.' };
  }

  if (input.isPrivate && input.domains.length > 0) {
    const { error: domainsError } = await supabase.from('allowed_domains').insert(
      input.domains.map((domain) => ({
        page_id: page!.id,
        domain: sanitizeText(domain).toLowerCase().trim(),
      }))
    );
    if (domainsError) {
      return { error: 'The election was created, but its allowed domains could not be saved.' };
    }
  }

  for (const [index, position] of input.positions.entries()) {
    const { data: createdPosition, error: positionError } = await supabase
      .from('positions')
      .insert({ page_id: page.id, title: sanitizeText(position.title), display_order: index })
      .select()
      .single();

    if (positionError || !createdPosition) {
      return { error: 'The election was created, but one of its positions could not be saved.' };
    }

    for (const candidate of position.candidates) {
      const { error: candidateError } = await supabase.from('candidates').insert({
        position_id: createdPosition.id,
        name: sanitizeText(candidate.name),
        bio: sanitizeText(candidate.bio),
      });
      if (candidateError) {
        return { error: 'The election was created, but one of its candidates could not be saved.' };
      }
    }
  }

  return { slug: page.slug };
}
