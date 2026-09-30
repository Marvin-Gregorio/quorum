import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { Candidate, Position, VoteTally } from '@/types/models';

type PositionWithCandidates = Pick<Position, 'id' | 'title'> & {
  candidates: Pick<Candidate, 'id' | 'name'>[];
};

export interface ResultsSnapshot {
  pageId: string;
  title: string;
  organizationName: string;
  positions: { id: string; title: string; candidates: { id: string; name: string; voteCount: number }[] }[];
}

export async function getResultsSnapshot(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  slug: string
): Promise<ResultsSnapshot | null> {
  const { data: page } = await supabase
    .from('pages')
    .select('id, title, organization_name')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return null;

  const { data: positionRows } = await supabase
    .from('positions')
    // See manage.ts for why the FK name must be spelled out here.
    .select('id, title, candidates!candidates_position_id_fkey(id, name)')
    .eq('page_id', page.id)
    .order('display_order');
  const positions = (positionRows ?? []) as unknown as PositionWithCandidates[];

  const positionIds = positions.map((p) => p.id);
  const { data: tallyRows } = await supabase
    .from('vote_tallies')
    .select('position_id, candidate_id, vote_count')
    .in('position_id', positionIds);
  const tallies = (tallyRows ?? []) as Pick<VoteTally, 'position_id' | 'candidate_id' | 'vote_count'>[];

  const countFor = (positionId: string, candidateId: string) =>
    tallies.find((t) => t.position_id === positionId && t.candidate_id === candidateId)?.vote_count ?? 0;

  return {
    pageId: page.id,
    title: page.title,
    organizationName: page.organization_name,
    positions: positions.map((p) => ({
      id: p.id,
      title: p.title,
      candidates: p.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        voteCount: countFor(p.id, c.id),
      })),
    })),
  };
}
