import imageCompression from 'browser-image-compression';

export async function compressCandidatePhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 800,
    maxSizeMB: 0.25,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}
