import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

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
  slug: string
): Promise<ManagedElection | null> {
  const { data: page } = await supabase.from('pages').select('*').eq('slug', slug).maybeSingle();
  if (!page) return null;

  const { data: domainRows } = await supabase.from('allowed_domains').select('domain').eq('page_id', page.id);

  const { data: positionRows } = await supabase
    .from('positions')
    .select('id, title, candidates(id, name, bio, photo_url)')
    .eq('page_id', page.id)
    .order('display_order');

  return {
    id: page.id,
    slug: page.slug,
    organizationName: page.organization_name,
    title: page.title,
    isPrivate: page.is_private,
    domains: (domainRows ?? []).map((d: any) => d.domain),
    votingStartsAt: page.voting_starts_at,
    votingEndsAt: page.voting_ends_at,
    ownerId: page.owner_id,
    positions: (positionRows ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      candidates: (p.candidates ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        photoUrl: c.photo_url,
      })),
    })),
  };
}
