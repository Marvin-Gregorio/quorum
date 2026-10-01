import { z } from 'zod';

export const pageSettingsSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(120),
    votingStartsAt: z.string().datetime(),
    votingEndsAt: z.string().datetime(),
    isPrivate: z.boolean(),
    domains: z.array(z.string().trim().min(1).max(255)),
  })
  .refine((data) => new Date(data.votingEndsAt) > new Date(data.votingStartsAt), {
    message: 'Voting must close after it opens',
    path: ['votingEndsAt'],
  });

export const positionSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

export const candidateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(500),
});

export const voteSchema = z.object({
  positionId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

// Candidate photos are uploaded directly from the browser to the
// candidate-photos Storage bucket (see AGENTS.md media rules); what's
// persisted is the object path (a signed URL is generated fresh at render
// time, since signed URLs expire), so the only thing a Server Action can
// validate is that the path actually has the shape the app's own upload
// code produces — two UUID segments and the fixed `.webp` extension
// compressCandidatePhoto always converts to — rather than an arbitrary
// attacker-supplied path.
const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CANDIDATE_PHOTO_PATH_PATTERN = new RegExp(`^${UUID_SEGMENT}/${UUID_SEGMENT}\\.webp$`, 'i');

export const candidatePhotoPathSchema = z
  .string()
  .regex(CANDIDATE_PHOTO_PATH_PATTERN, 'Invalid photo path.');
