'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  candidatePhotoPathSchema,
  candidateSchema,
  idSchema,
  pageSettingsSchema,
  positionSchema,
  type CandidateInput,
  type PageSettingsInput,
} from '@/lib/validation';
import { parseInput } from '@/lib/validate-input';
import * as manageService from '@/services/manage';

// The parameter types only help client callers compile; a Server Action is a
// public HTTP endpoint, so every argument is re-validated at runtime.

export async function updateElectionSettingsAction(
  pageId: string,
  input: PageSettingsInput
): Promise<{ ok: true } | { error: string }> {
  const id = parseInput(idSchema, pageId);
  if ('error' in id) return id;
  const settings = parseInput(pageSettingsSchema, input);
  if ('error' in settings) return settings;

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'You must be signed in.' };

  return manageService.updateElectionSettings(supabase, userData.user.id, id.data, settings.data);
}

export async function updateCandidatePhotoAction(
  candidateId: string,
  photoPath: string
): Promise<{ ok: true } | { error: string }> {
  const id = parseInput(idSchema, candidateId);
  if ('error' in id) return id;
  const path = parseInput(candidatePhotoPathSchema, photoPath);
  if ('error' in path) return path;

  const supabase = await createServerSupabaseClient();
  return manageService.updateCandidatePhoto(supabase, id.data, path.data);
}

export async function createCandidateAction(
  positionId: string,
  input: CandidateInput
): Promise<{ id: string } | { error: string }> {
  const id = parseInput(idSchema, positionId);
  if ('error' in id) return id;
  const candidate = parseInput(candidateSchema, input);
  if ('error' in candidate) return candidate;

  const supabase = await createServerSupabaseClient();
  return manageService.createCandidate(supabase, id.data, candidate.data);
}

export async function updateCandidateAction(
  candidateId: string,
  input: CandidateInput
): Promise<{ ok: true } | { error: string }> {
  const id = parseInput(idSchema, candidateId);
  if ('error' in id) return id;
  const candidate = parseInput(candidateSchema, input);
  if ('error' in candidate) return candidate;

  const supabase = await createServerSupabaseClient();
  return manageService.updateCandidate(supabase, id.data, candidate.data);
}

export async function deleteCandidateAction(candidateId: string): Promise<{ ok: true } | { error: string }> {
  const id = parseInput(idSchema, candidateId);
  if ('error' in id) return id;

  const supabase = await createServerSupabaseClient();
  return manageService.deleteCandidate(supabase, id.data);
}

export async function createPositionAction(
  pageId: string,
  title: string
): Promise<{ id: string } | { error: string }> {
  const id = parseInput(idSchema, pageId);
  if ('error' in id) return id;
  const position = parseInput(positionSchema, { title });
  if ('error' in position) return position;

  const supabase = await createServerSupabaseClient();
  return manageService.createPosition(supabase, id.data, position.data.title);
}

export async function deletePositionAction(positionId: string): Promise<{ ok: true } | { error: string }> {
  const id = parseInput(idSchema, positionId);
  if ('error' in id) return id;

  const supabase = await createServerSupabaseClient();
  return manageService.deletePosition(supabase, id.data);
}
