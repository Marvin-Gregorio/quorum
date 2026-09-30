import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { Candidate, Position, Vote } from '@/types/models';

type PositionWithCandidates = Pick<Position, 'id' | 'title'> & {
  candidates: Pick<Candidate, 'id' | 'name' | 'bio' | 'photo_url'>[];
};

export interface Ballot {
  pageId: string;
  title: string;
  organizationName: string;
  votingEndsAt: string;
  positions: {
    id: string;
    title: string;
    candidates: { id: string; name: string; bio: string; photoUrl: string | null }[];
    selectedCandidateId: string | null;
  }[];
}

export async function getBallot(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  slug: string,
  voterId: string
): Promise<Ballot | null> {
  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return null;

  const { data: positionRows } = await supabase
    .from('positions')
    // See manage.ts for why the FK name must be spelled out here.
    .select('id, title, candidates!candidates_position_id_fkey(id, name, bio, photo_url)')
    .eq('page_id', page.id)
    .order('display_order');
  const positions = (positionRows ?? []) as unknown as PositionWithCandidates[];

  const positionIds = positions.map((p) => p.id);

  const { data: myVotes } = positionIds.length
    ? await supabase
        .from('votes')
        .select('position_id, candidate_id')
        .eq('voter_id', voterId)
        .in('position_id', positionIds)
    : { data: [] as Pick<Vote, 'position_id' | 'candidate_id'>[] };

  const selectedByPosition = new Map((myVotes ?? []).map((v) => [v.position_id, v.candidate_id]));

  return {
    pageId: page.id,
    title: page.title,
    organizationName: page.organization_name,
    votingEndsAt: page.voting_ends_at,
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_url,
      })),
      selectedCandidateId: selectedByPosition.get(p.id) ?? null,
    })),
  };
}

export async function castVote(
  supabase: SupabaseClient<Database>,
  voterId: string,
  positionId: string,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from('votes')
    .upsert(
      { voter_id: voterId, position_id: positionId, candidate_id: candidateId },
      { onConflict: 'voter_id,position_id' }
    );

  if (error) return { error: 'Your vote could not be recorded. Voting may be closed for this election.' };
  return { ok: true };
}
