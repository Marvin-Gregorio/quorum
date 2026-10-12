'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createElectionSchema, type CreateElectionInput } from '@/lib/validation';
import { parseInput } from '@/lib/validate-input';
import { createElection, type CreatedElection } from '@/services/manage';
import { createElectionRateLimit } from '@/lib/rate-limit';

export type { CreateElectionInput, CreatedElection };

export async function createElectionAction(input: CreateElectionInput): Promise<CreatedElection | { error: string }> {
  const parsed = parseInput(createElectionSchema, input);
  if ('error' in parsed) return parsed;

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'You must be signed in to create an election.' };
  }

  const { success } = await createElectionRateLimit.limit(userData.user.id);
  if (!success) return { error: 'Too many elections created recently. Please try again later.' };

  return createElection(supabase, userData.user.id, parsed.data);
}
