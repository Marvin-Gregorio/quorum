import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

export type PageAccess = 'ok' | 'sign-in' | 'restricted';

export async function checkPageAccess(
  supabase: SupabaseClient<Database>,
  page: { id: string; is_private: boolean; owner_id: string },
  userId: string | null,
  userEmail: string | null
): Promise<PageAccess> {
  if (!userId) return 'sign-in';
  if (!page.is_private) return 'ok';
  if (userId === page.owner_id) return 'ok';

  const { data: allowed } = await supabase.rpc('is_domain_allowed', {
    p_page_id: page.id,
    p_email: userEmail ?? '',
  });

  return allowed ? 'ok' : 'restricted';
}
