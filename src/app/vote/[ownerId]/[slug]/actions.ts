'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { voteSchema } from '@/lib/validation';

export async function castVoteAction(
  positionId: string,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const result = voteSchema.safeParse({ positionId, candidateId });
  if (!result.success) return { error: 'Please select a candidate before casting your vote.' };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in to vote.' };

  const { error } = await supabase
    .from('votes')
    .upsert(
      { voter_id: userData.user.id, position_id: positionId, candidate_id: candidateId },
      { onConflict: 'voter_id,position_id' }
    );

  if (error) return { error: 'Your vote could not be recorded. Voting may be closed for this election.' };
  return { ok: true };
}
