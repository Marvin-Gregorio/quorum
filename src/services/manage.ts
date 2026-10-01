import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { AllowedDomain, Candidate, Position } from '@/types/models';
import { sanitizeText } from '@/lib/sanitize';
import { generateUniqueSlug, nextSlugAttempt, slugify } from '@/lib/slug';
import { signCandidatePhotoUrls } from '@/lib/candidate-photos';

const MAX_SLUG_INSERT_ATTEMPTS = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

type PositionWithCandidates = Pick<Position, 'id' | 'title'> & {
  candidates: Pick<Candidate, 'id' | 'name' | 'bio' | 'photo_path'>[];
};

export interface ManagedElection {
  id: string;
  slug: string;
  organizationName: string;
  title: string;
  isPrivate: boolean;
  domains: string[];
  votingStartsAt: string;
  votingEndsAt: string;
  ownerId: string;
  positions: {
    id: string;
    title: string;
    candidates: { id: string; name: string; bio: string; photoUrl: string | null }[];
  }[];
}

export async function getManagedElection(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  slug: string
): Promise<ManagedElection | null> {
  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return null;

  const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', page.id);
  const domains = (domainRows ?? []) as Pick<AllowedDomain, 'domain'>[];

  const { data: positionRows } = await supabase
    .from('positions')
    // `candidates!candidates_position_id_fkey` disambiguates this embed:
    // vote_tallies also has FKs to both positions and candidates, so
    // PostgREST otherwise sees two valid relationship paths and refuses
    // the query (PGRST201) instead of guessing which one is meant.
    .select('id, title, candidates!candidates_position_id_fkey(id, name, bio, photo_path)')
    .eq('page_id', page.id)
    .order('display_order');
  const positions = (positionRows ?? []) as unknown as PositionWithCandidates[];

  const signedPhotoUrls = await signCandidatePhotoUrls(
    supabase,
    positions.flatMap((p) => p.candidates.map((c) => c.photo_path))
  );

  return {
    id: page.id,
    slug: page.slug,
    organizationName: page.organization_name,
    title: page.title,
    isPrivate: page.is_private,
    domains: domains.map((d) => d.domain),
    votingStartsAt: page.voting_starts_at,
    votingEndsAt: page.voting_ends_at,
    ownerId: page.owner_id,
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_path ? (signedPhotoUrls.get(c.photo_path) ?? null) : null,
      })),
    })),
  };
}

export interface CreateElectionInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
  positions: { title: string; candidates: { name: string; bio: string }[] }[];
}

export interface CreatedElection {
  slug: string;
  pageId: string;
  ownerId: string;
  positions: { title: string; id: string; candidates: { name: string; id: string }[] }[];
}

async function insertPageWithUniqueSlug(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CreateElectionInput
): Promise<{ id: string; slug: string } | { error: string }> {
  const baseSlug = slugify(input.title) || undefined;
  let slug = await generateUniqueSlug(supabase, input.title, ownerId);

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
        owner_id: ownerId,
        is_private: input.isPrivate,
        voting_starts_at: input.votingStartsAt,
        voting_ends_at: input.votingEndsAt,
      })
      .select()
      .single();

    if (!pageError && data) return data;

    if (pageError?.code === POSTGRES_UNIQUE_VIOLATION && baseSlug) {
      slug = nextSlugAttempt(baseSlug, slug);
      continue;
    }

    if (pageError) console.error(pageError);
    return { error: 'Could not create the election. Please try again.' };
  }

  return { error: 'Could not create the election. Please try again.' };
}

async function insertAllowedDomains(
  supabase: SupabaseClient<Database>,
  pageId: string,
  domains: string[]
): Promise<{ error?: string }> {
  if (domains.length === 0) return {};
  const { error } = await supabase.from('allowed_domains').insert(
    domains.map((domain) => ({
      page_id: pageId,
      domain: sanitizeText(domain).toLowerCase().trim(),
    }))
  );
  if (error) console.error(error);
  return error ? { error: 'Could not save the allowed domains.' } : {};
}

async function insertPositionsWithCandidates(
  supabase: SupabaseClient<Database>,
  pageId: string,
  positions: CreateElectionInput['positions']
): Promise<CreatedElection['positions'] | { error: string }> {
  const createdPositions: CreatedElection['positions'] = [];

  for (const [index, position] of positions.entries()) {
    const { data: createdPosition, error: positionError } = await supabase
      .from('positions')
      .insert({ page_id: pageId, title: sanitizeText(position.title), display_order: index })
      .select()
      .single();

    if (positionError || !createdPosition) {
      if (positionError) console.error(positionError);
      return { error: 'The election was created, but one of its positions could not be saved.' };
    }

    const createdCandidates: { name: string; id: string }[] = [];
    for (const candidate of position.candidates) {
      const { data: createdCandidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          position_id: createdPosition.id,
          name: sanitizeText(candidate.name),
          bio: sanitizeText(candidate.bio),
        })
        .select()
        .single();
      if (candidateError || !createdCandidate) {
        if (candidateError) console.error(candidateError);
        return { error: 'The election was created, but one of its candidates could not be saved.' };
      }
      createdCandidates.push({ name: candidate.name, id: createdCandidate.id });
    }
    createdPositions.push({ title: position.title, id: createdPosition.id, candidates: createdCandidates });
  }

  return createdPositions;
}

export async function createElection(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: CreateElectionInput
): Promise<CreatedElection | { error: string }> {
  if (new Date(input.votingStartsAt).getTime() <= Date.now()) {
    return { error: 'Voting must start in the future.' };
  }

  const page = await insertPageWithUniqueSlug(supabase, ownerId, input);
  if ('error' in page) return page;

  if (input.isPrivate) {
    const domainsResult = await insertAllowedDomains(supabase, page.id, input.domains);
    if (domainsResult.error) {
      return { error: `The election was created, but its allowed domains could not be saved.` };
    }
  }

  const positions = await insertPositionsWithCandidates(supabase, page.id, input.positions);
  if ('error' in positions) return positions;

  return { slug: page.slug, pageId: page.id, ownerId, positions };
}

export interface PageSettingsInput {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
}

export async function updateElectionSettings(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  pageId: string,
  input: PageSettingsInput
): Promise<{ ok: true } | { error: string }> {
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
    .eq('owner_id', ownerId)
    .select('id');

  if (error || !updatedRows || updatedRows.length === 0) {
    if (error) console.error(error);
    return { error: 'Could not save settings.' };
  }

  await supabase.from('allowed_domains').delete().eq('page_id', pageId);
  if (input.isPrivate) {
    const domainsResult = await insertAllowedDomains(supabase, pageId, input.domains);
    if (domainsResult.error) return { error: 'Settings were saved, but the allowed domains could not be updated.' };
  }

  return { ok: true };
}

export async function updateCandidatePhoto(
  supabase: SupabaseClient<Database>,
  candidateId: string,
  photoPath: string
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase
    .from('candidates')
    .update({ photo_path: photoPath })
    .eq('id', candidateId)
    .select('id');

  if (error || !data || data.length === 0) {
    if (error) console.error(error);
    return { error: 'Could not save the candidate photo.' };
  }
  return { ok: true };
}

export async function createCandidate(
  supabase: SupabaseClient<Database>,
  positionId: string,
  input: { name: string; bio: string }
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('candidates')
    .insert({ position_id: positionId, name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .select()
    .single();

  if (error || !data) {
    if (error) console.error(error);
    return { error: 'Could not add the candidate. Positions may be locked once voting opens.' };
  }
  return { id: data.id };
}

export async function updateCandidate(
  supabase: SupabaseClient<Database>,
  candidateId: string,
  input: { name: string; bio: string }
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase
    .from('candidates')
    .update({ name: sanitizeText(input.name), bio: sanitizeText(input.bio) })
    .eq('id', candidateId)
    .select('id');

  if (error || !data || data.length === 0) {
    if (error) console.error(error);
    return { error: 'Could not save the candidate.' };
  }
  return { ok: true };
}

export async function deleteCandidate(
  supabase: SupabaseClient<Database>,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.from('candidates').delete().eq('id', candidateId).select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error(error);
    return { error: 'Could not delete the candidate. Positions may be locked once voting opens.' };
  }
  return { ok: true };
}

export async function createPosition(
  supabase: SupabaseClient<Database>,
  pageId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  const { count } = await supabase
    .from('positions')
    .select('id', { count: 'exact', head: true })
    .eq('page_id', pageId);

  const { data, error } = await supabase
    .from('positions')
    .insert({ page_id: pageId, title: sanitizeText(title), display_order: count ?? 0 })
    .select()
    .single();

  if (error || !data) {
    if (error) console.error(error);
    return { error: 'Positions can only be added before voting opens.' };
  }
  return { id: data.id };
}

export async function deletePosition(
  supabase: SupabaseClient<Database>,
  positionId: string
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.from('positions').delete().eq('id', positionId).select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error(error);
    return { error: 'Positions can only be removed before voting opens.' };
  }
  return { ok: true };
}
