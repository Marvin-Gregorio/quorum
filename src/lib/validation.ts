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
// candidate-photos Storage bucket (see AGENTS.md media rules), so the only
// thing a Server Action can validate is that the resulting URL actually
// points into that bucket rather than an arbitrary attacker-supplied URL.
const CANDIDATE_PHOTOS_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/candidate-photos/`;

export const candidatePhotoUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith(CANDIDATE_PHOTOS_PREFIX), {
    message: 'Photo URL must point to the candidate-photos storage bucket.',
  });
