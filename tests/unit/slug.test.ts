import { describe, it, expect } from 'vitest';
import { slugify, generateUniqueSlug } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('2026 Board Election')).toBe('2026-board-election');
  });

  it('strips punctuation', () => {
    expect(slugify("Riverside Co-op's Election!")).toBe('riverside-co-ops-election');
  });
});

describe('generateUniqueSlug', () => {
  it('returns the plain slug when it is not taken', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const slug = await generateUniqueSlug(supabase, '2026 Board Election', 'owner-1');
    expect(slug).toBe('2026-board-election');
  });

  it('appends -2 when the plain slug is already taken', async () => {
    let call = 0;
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => {
                call += 1;
                return Promise.resolve(call === 1 ? { data: { id: 'existing' }, error: null } : { data: null, error: null });
              },
            }),
          }),
        }),
      }),
    } as any;
    const slug = await generateUniqueSlug(supabase, '2026 Board Election', 'owner-1');
    expect(slug).toBe('2026-board-election-2');
  });
});
