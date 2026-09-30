import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { Page } from '@/types/models';

type ManagedPageSummaryRow = Pick<
  Page,
  'id' | 'slug' | 'title' | 'organization_name' | 'voting_starts_at' | 'voting_ends_at'
>;

export interface ManagedElectionSummary {
  id: string;
  slug: string;
  title: string;
  organizationName: string;
  status: 'open' | 'closed' | 'scheduled';
}

function statusFor(startsAt: string, endsAt: string): ManagedElectionSummary['status'] {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return 'scheduled';
  if (now > new Date(endsAt).getTime()) return 'closed';
  return 'open';
}

export async function getManagedElections(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ManagedElectionSummary[]> {
  const { data } = await supabase
    .from('pages')
    .select('id, slug, title, organization_name, voting_starts_at, voting_ends_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  const pages = (data ?? []) as ManagedPageSummaryRow[];

  return pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    organizationName: page.organization_name,
    status: statusFor(page.voting_starts_at, page.voting_ends_at),
  }));
}
