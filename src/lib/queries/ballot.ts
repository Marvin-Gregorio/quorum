import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

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
  slug: string,
  voterId: string
): Promise<Ballot | null> {
  const { data: page } = await supabase.from('pages').select('*').eq('slug', slug).maybeSingle();
  if (!page) return null;

  const { data: positionRows } = await supabase
    .from('positions')
    .select('id, title, candidates(id, name, bio, photo_url)')
    .eq('page_id', page.id)
    .order('display_order');

  const positionIds = (positionRows ?? []).map((p: any) => p.id);

  const { data: myVotes } = positionIds.length
    ? await supabase
        .from('votes')
        .select('position_id, candidate_id')
        .eq('voter_id', voterId)
        .in('position_id', positionIds)
    : { data: [] };

  const selectedByPosition = new Map((myVotes ?? []).map((v: any) => [v.position_id, v.candidate_id]));

  return {
    pageId: page.id,
    title: page.title,
    organizationName: page.organization_name,
    votingEndsAt: page.voting_ends_at,
    positions: (positionRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      candidates: (p.candidates ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_url,
      })),
      selectedCandidateId: selectedByPosition.get(p.id) ?? null,
    })),
  };
}
