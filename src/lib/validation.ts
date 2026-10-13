import { z } from 'zod';

export const MAX_POSITIONS_PER_ELECTION = 20;
export const MAX_CANDIDATES_PER_POSITION = 50;
// Pre-compression ceiling: compressCandidatePhoto re-encodes to ~150-250KB
// WebP, so this only guards against a browser tab choking on a huge file.
export const MAX_PHOTO_FILE_BYTES = 10 * 1024 * 1024;

export const idSchema = z.uuid('Invalid identifier.');

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Allowed domain cannot be empty.')
  .max(255, 'Allowed domain must be 255 characters or fewer.')
  .regex(DOMAIN_PATTERN, 'Allowed domains must look like "example.com".');

// Kept as a plain object (no .refine) because Zod 4 refuses to .extend() a
// refined object; createElectionSchema extends these fields and re-applies
// the shared date refinement itself.
const pageSettingsFields = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, 'Organization name is required.')
    .max(120, 'Organization name must be 120 characters or fewer.'),
  title: z
    .string()
    .trim()
    .min(1, 'Election title is required.')
    .max(120, 'Election title must be 120 characters or fewer.'),
  votingStartsAt: z.iso.datetime('Please set an opening date and time for voting.'),
  votingEndsAt: z.iso.datetime('Please set a closing date and time for voting.'),
  isPrivate: z.boolean(),
  domains: z.array(domainSchema),
});

function closesAfterItOpens(data: { votingStartsAt: string; votingEndsAt: string }) {
  return new Date(data.votingEndsAt) > new Date(data.votingStartsAt);
}

const CLOSES_AFTER_OPENS = {
  message: 'Voting must close after it opens.',
  path: ['votingEndsAt'],
};

export const pageSettingsSchema = pageSettingsFields.refine(closesAfterItOpens, CLOSES_AFTER_OPENS);

export const positionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Position title is required.')
    .max(100, 'Position title must be 100 characters or fewer.'),
});

export const candidateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Candidate name is required.')
    .max(100, 'Candidate name must be 100 characters or fewer.'),
  bio: z.string().trim().max(500, 'Candidate bio must be 500 characters or fewer.'),
});

export const createElectionSchema = pageSettingsFields
  .extend({
    positions: z
      .array(
        positionSchema.extend({
          candidates: z
            .array(candidateSchema)
            .min(1, 'Every position needs at least one candidate.')
            .max(MAX_CANDIDATES_PER_POSITION, `A position can have at most ${MAX_CANDIDATES_PER_POSITION} candidates.`),
        })
      )
      .min(1, 'Add at least one position.')
      .max(MAX_POSITIONS_PER_ELECTION, `An election can have at most ${MAX_POSITIONS_PER_ELECTION} positions.`),
  })
  .refine(closesAfterItOpens, CLOSES_AFTER_OPENS);

export const voteSchema = z.object({
  positionId: z.uuid('Please select a candidate before casting your vote.'),
  candidateId: z.uuid('Please select a candidate before casting your vote.'),
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

// Browser-only: runs before compression, so it can't be part of any Server
// Action — the server only ever sees the resulting Storage path.
export const photoFileSchema = z
  .instanceof(File, { error: 'Please choose an image file.' })
  .refine((file) => file.type.startsWith('image/'), 'Candidate photo must be an image.')
  .refine((file) => file.size <= MAX_PHOTO_FILE_BYTES, 'Candidate photo must be 10 MB or smaller.');

// Only a same-origin relative path is a safe redirect target: a single
// leading '/', not '//' (protocol-relative, e.g. "//evil.com") or '/\'
// (browsers normalise the backslash to a slash), otherwise a crafted `next`
// value could send a signed-in user to an attacker's site (open redirect).
export const safeNextPathSchema = z
  .string()
  .refine((path) => path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\'));

export type PageSettingsInput = z.infer<typeof pageSettingsSchema>;
export type CreateElectionInput = z.infer<typeof createElectionSchema>;
export type CandidateInput = z.infer<typeof candidateSchema>;
