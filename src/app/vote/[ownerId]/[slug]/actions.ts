'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { voteSchema } from '@/lib/validation';
import { castVote } from '@/services/ballot';

export async function castVoteAction(
  positionId: string,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const result = voteSchema.safeParse({ positionId, candidateId });
  if (!result.success) return { error: 'Please select a candidate before casting your vote.' };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in to vote.' };

  return castVote(supabase, userData.user.id, positionId, candidateId);
}
