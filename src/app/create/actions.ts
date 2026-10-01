'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';
import { createElection, type CreateElectionInput, type CreatedElection } from '@/services/manage';
import { createElectionRateLimit } from '@/lib/rate-limit';

export type { CreateElectionInput, CreatedElection };

export async function createElectionAction(
  input: CreateElectionInput
): Promise<CreatedElection | { error: string }> {
  const settingsResult = pageSettingsSchema.safeParse(input);
  if (!settingsResult.success) {
    return { error: settingsResult.error.issues[0].message };
  }

  for (const position of input.positions) {
    const positionResult = positionSchema.safeParse(position);
    if (!positionResult.success) {
      return { error: positionResult.error.issues[0].message };
    }
    for (const candidate of position.candidates) {
      const candidateResult = candidateSchema.safeParse(candidate);
      if (!candidateResult.success) {
        return { error: candidateResult.error.issues[0].message };
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'You must be signed in to create an election.' };
  }

  const { success } = await createElectionRateLimit.limit(userData.user.id);
  if (!success) return { error: 'Too many elections created recently. Please try again later.' };

  return createElection(supabase, userData.user.id, input);
}
