import { describe, it, expect } from 'vitest';
import {
  pageSettingsSchema,
  positionSchema,
  candidateSchema,
  createElectionSchema,
  domainSchema,
  idSchema,
  voteSchema,
  candidatePhotoPathSchema,
  photoFileSchema,
  safeNextPathSchema,
  MAX_POSITIONS_PER_ELECTION,
  MAX_CANDIDATES_PER_POSITION,
} from '@/lib/validation';
import { parseInput } from '@/lib/validate-input';

const VALID_SETTINGS = {
  organizationName: 'Riverside Tenants Cooperative',
  title: '2026 Board Election',
  votingStartsAt: '2026-02-28T09:00:00.000Z',
  votingEndsAt: '2026-03-14T17:00:00.000Z',
  isPrivate: false,
  domains: [],
};

describe('pageSettingsSchema', () => {
  it('accepts a valid settings payload', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: true,
      domains: ['riverside.coop'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '',
      votingStartsAt: '2026-02-28T09:00:00.000Z',
      votingEndsAt: '2026-03-14T17:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const result = pageSettingsSchema.safeParse({
      organizationName: 'Riverside Tenants Cooperative',
      title: '2026 Board Election',
      votingStartsAt: '2026-03-14T17:00:00.000Z',
      votingEndsAt: '2026-02-28T09:00:00.000Z',
      isPrivate: false,
      domains: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('positionSchema', () => {
  it('rejects a title over 100 characters', () => {
    const result = positionSchema.safeParse({ title: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('candidateSchema', () => {
  it('accepts a valid candidate', () => {
    const result = candidateSchema.safeParse({ name: 'Dana Okafor', bio: 'Eight years on the committee.' });
    expect(result.success).toBe(true);
  });

  it('rejects a bio over 500 characters', () => {
    const result = candidateSchema.safeParse({ name: 'Dana Okafor', bio: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('error messages', () => {
  it('names the offending field instead of using a Zod default', () => {
    expect(parseInput(positionSchema, { title: '' })).toEqual({ error: 'Position title is required.' });
    expect(parseInput(candidateSchema, { name: '', bio: '' })).toEqual({ error: 'Candidate name is required.' });
    expect(parseInput(pageSettingsSchema, { ...VALID_SETTINGS, title: ' ' })).toEqual({
      error: 'Election title is required.',
    });
  });

  it('reports a cleared date input as a missing date', () => {
    expect(parseInput(pageSettingsSchema, { ...VALID_SETTINGS, votingStartsAt: '' })).toEqual({
      error: 'Please set an opening date and time for voting.',
    });
  });

  it('never throws on a payload that is not even an object', () => {
    expect('error' in parseInput(pageSettingsSchema, null)).toBe(true);
    expect('error' in parseInput(createElectionSchema, 'nope')).toBe(true);
  });

  it('returns the trimmed value as data', () => {
    expect(parseInput(candidateSchema, { name: '  Dana  ', bio: ' hi ' })).toEqual({
      data: { name: 'Dana', bio: 'hi' },
    });
  });
});

describe('domainSchema', () => {
  it('lowercases and trims a valid domain', () => {
    expect(domainSchema.parse('  Riverside.Coop ')).toBe('riverside.coop');
  });

  it.each(['foo bar', 'nodot', '-bad.com', 'bad-.com', 'a..com', '@riverside.coop', 'https://riverside.coop'])(
    'rejects %s',
    (value) => {
      expect(domainSchema.safeParse(value).success).toBe(false);
    }
  );

  it('is applied to every entry in a settings payload', () => {
    const result = pageSettingsSchema.safeParse({ ...VALID_SETTINGS, isPrivate: true, domains: ['ok.com', 'foo bar'] });
    expect(result.success).toBe(false);
  });
});

describe('createElectionSchema', () => {
  const valid = {
    ...VALID_SETTINGS,
    positions: [{ title: 'Chair', candidates: [{ name: 'Dana', bio: '' }] }],
  };

  it('accepts a full election payload', () => {
    expect(createElectionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects positions that are not an array', () => {
    expect(createElectionSchema.safeParse({ ...valid, positions: 'x' }).success).toBe(false);
    expect(createElectionSchema.safeParse({ ...VALID_SETTINGS }).success).toBe(false);
  });

  it('validates nested positions and candidates', () => {
    expect(parseInput(createElectionSchema, { ...valid, positions: [{ title: '', candidates: [] }] })).toEqual({
      error: 'Position title is required.',
    });
    expect(
      parseInput(createElectionSchema, { ...valid, positions: [{ title: 'Chair', candidates: [{ name: '', bio: '' }] }] })
    ).toEqual({ error: 'Candidate name is required.' });
  });

  it('still requires the election to close after it opens', () => {
    const result = createElectionSchema.safeParse({
      ...valid,
      votingStartsAt: VALID_SETTINGS.votingEndsAt,
      votingEndsAt: VALID_SETTINGS.votingStartsAt,
    });
    expect(result.success).toBe(false);
  });

  it('caps positions and candidates per position', () => {
    const tooManyPositions = Array.from({ length: MAX_POSITIONS_PER_ELECTION + 1 }, () => ({
      title: 'P',
      candidates: [],
    }));
    expect(createElectionSchema.safeParse({ ...valid, positions: tooManyPositions }).success).toBe(false);

    const tooManyCandidates = Array.from({ length: MAX_CANDIDATES_PER_POSITION + 1 }, () => ({ name: 'C', bio: '' }));
    expect(
      createElectionSchema.safeParse({ ...valid, positions: [{ title: 'P', candidates: tooManyCandidates }] }).success
    ).toBe(false);
  });
});

describe('idSchema and voteSchema', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('accepts a UUID and rejects anything else', () => {
    expect(idSchema.safeParse(ID).success).toBe(true);
    expect(idSchema.safeParse('pos-1').success).toBe(false);
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse(undefined).success).toBe(false);
  });

  it('requires both ids of a vote to be UUIDs', () => {
    expect(voteSchema.safeParse({ positionId: ID, candidateId: ID }).success).toBe(true);
    expect(voteSchema.safeParse({ positionId: ID, candidateId: '' }).success).toBe(false);
    expect(voteSchema.safeParse({ positionId: 'x', candidateId: ID }).success).toBe(false);
  });
});

describe('candidatePhotoPathSchema', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('accepts only <uuid>/<uuid>.webp', () => {
    expect(candidatePhotoPathSchema.safeParse(`${ID}/${ID}.webp`).success).toBe(true);
    expect(candidatePhotoPathSchema.safeParse(`${ID}/${ID}.png`).success).toBe(false);
    expect(candidatePhotoPathSchema.safeParse(`../${ID}.webp`).success).toBe(false);
    expect(candidatePhotoPathSchema.safeParse(`${ID}/${ID}/x.webp`).success).toBe(false);
  });
});

describe('photoFileSchema', () => {
  it('accepts an image', () => {
    expect(photoFileSchema.safeParse(new File(['x'], 'a.png', { type: 'image/png' })).success).toBe(true);
  });

  it('rejects a non-image file', () => {
    expect(parseInput(photoFileSchema, new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toEqual({
      error: 'Candidate photo must be an image.',
    });
  });

  it('rejects a file over the size limit', () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    expect('error' in parseInput(photoFileSchema, big)).toBe(true);
  });

  it('rejects something that is not a File', () => {
    expect('error' in parseInput(photoFileSchema, 'a.png')).toBe(true);
  });
});

describe('safeNextPathSchema', () => {
  it.each(['/', '/vote/abc/def', '/profile?x=1'])('accepts %s', (path) => {
    expect(safeNextPathSchema.safeParse(path).success).toBe(true);
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', 'javascript:alert(1)'])(
    'rejects %s',
    (path) => {
      expect(safeNextPathSchema.safeParse(path).success).toBe(false);
    }
  );

  it('rejects null and undefined (no next param)', () => {
    expect(safeNextPathSchema.safeParse(null).success).toBe(false);
    expect(safeNextPathSchema.safeParse(undefined).success).toBe(false);
  });
});
