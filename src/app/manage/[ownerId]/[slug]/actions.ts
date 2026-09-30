'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { pageSettingsSchema, candidateSchema, positionSchema } from '@/lib/validation';
import * as manageService from '@/services/manage';
import type { PageSettingsInput } from '@/services/manage';

export type { PageSettingsInput };

export async function updateElectionSettingsAction(
  pageId: string,
  input: PageSettingsInput
): Promise<{ ok: true } | { error: string }> {
  const result = pageSettingsSchema.safeParse(input);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in.' };

  return manageService.updateElectionSettings(supabase, userData.user.id, pageId, input);
}

export async function updateCandidatePhotoAction(
  candidateId: string,
  photoUrl: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  return manageService.updateCandidatePhoto(supabase, candidateId, photoUrl);
}

export async function createCandidateAction(
  positionId: string,
  input: { name: string; bio: string }
): Promise<{ id: string } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  return manageService.createCandidate(supabase, positionId, input);
}

export async function updateCandidateAction(
  candidateId: string,
  input: { name: string; bio: string }
): Promise<{ ok: true } | { error: string }> {
  const result = candidateSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  return manageService.updateCandidate(supabase, candidateId, input);
}

export async function deleteCandidateAction(candidateId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  return manageService.deleteCandidate(supabase, candidateId);
}

export async function createPositionAction(
  pageId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  const result = positionSchema.safeParse({ title });
  if (!result.success) return { error: result.error.issues[0].message };

  const supabase = await createServerSupabaseClient();
  return manageService.createPosition(supabase, pageId, title);
}

export async function deletePositionAction(positionId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  return manageService.deletePosition(supabase, positionId);
}
