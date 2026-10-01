import { describe, it, expect } from 'vitest';
import { signCandidatePhotoUrls } from '@/lib/candidate-photos';

describe('signCandidatePhotoUrls', () => {
  it('returns an empty map without calling storage when every path is null', async () => {
    const supabase = {
      storage: {
        from: () => {
          throw new Error('should not be called when there is nothing to sign');
        },
      },
    } as any;

    const result = await signCandidatePhotoUrls(supabase, [null, null]);
    expect(result.size).toBe(0);
  });

  it('batches every non-null path into one createSignedUrls call', async () => {
    const calls: { paths: string[]; expiresIn: number }[] = [];
    const supabase = {
      storage: {
        from: (bucket: string) => {
          expect(bucket).toBe('candidate-photos');
          return {
            createSignedUrls: async (paths: string[], expiresIn: number) => {
              calls.push({ paths, expiresIn });
              return {
                data: paths.map((path) => ({ path, signedUrl: `https://example.supabase.co/sign/${path}`, error: null })),
                error: null,
              };
            },
          };
        },
      },
    } as any;

    const result = await signCandidatePhotoUrls(supabase, ['page-1/cand-1.webp', null, 'page-1/cand-2.webp']);

    expect(calls).toHaveLength(1);
    expect(calls[0].paths).toEqual(['page-1/cand-1.webp', 'page-1/cand-2.webp']);
    expect(result.get('page-1/cand-1.webp')).toBe('https://example.supabase.co/sign/page-1/cand-1.webp');
    expect(result.get('page-1/cand-2.webp')).toBe('https://example.supabase.co/sign/page-1/cand-2.webp');
  });

  it('omits a path that failed to sign rather than throwing', async () => {
    const supabase = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) => ({ path, signedUrl: null, error: 'not found' })),
            error: null,
          }),
        }),
      },
    } as any;

    const result = await signCandidatePhotoUrls(supabase, ['page-1/cand-1.webp']);
    expect(result.size).toBe(0);
  });
});
