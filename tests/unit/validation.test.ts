import { describe, it, expect } from 'vitest';
import { pageSettingsSchema, positionSchema, candidateSchema } from '@/lib/validation';

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
