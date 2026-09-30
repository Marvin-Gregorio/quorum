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
