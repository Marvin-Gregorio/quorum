import { describe, it, expect, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => new File([file], 'compressed.webp', { type: 'image/webp' })),
}));

import imageCompression from 'browser-image-compression';
import { compressCandidatePhoto } from '@/lib/image-compression';

describe('compressCandidatePhoto', () => {
  it('calls browser-image-compression with the documented bounds', async () => {
    const input = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await compressCandidatePhoto(input);
    expect(imageCompression).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        maxWidthOrHeight: 800,
        fileType: 'image/webp',
      })
    );
  });

  it('returns the compressed file', async () => {
    const input = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressCandidatePhoto(input);
    expect(result.name).toBe('compressed.webp');
  });
});
