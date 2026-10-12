'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { voteSchema } from '@/lib/validation';
import { parseInput } from '@/lib/validate-input';
import { castVote } from '@/services/ballot';
import { voteRateLimit } from '@/lib/rate-limit';

export async function castVoteAction(
  positionId: string,
  candidateId: string
): Promise<{ ok: true } | { error: string }> {
  const vote = parseInput(voteSchema, { positionId, candidateId });
  if ('error' in vote) return vote;

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in to vote.' };

  const { success } = await voteRateLimit.limit(userData.user.id);
  if (!success) return { error: 'Too many vote changes recently. Please slow down and try again.' };

  return castVote(supabase, userData.user.id, vote.data.positionId, vote.data.candidateId);
}
