'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';
import { updateCandidatePhotoAction } from './actions';

export function CandidatePhotoUpload({
  candidateId,
  pageId,
  onUploaded,
}: {
  candidateId: string;
  pageId: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserSupabaseClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const compressed = await compressCandidatePhoto(file);
      const path = `${pageId}/${candidateId}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('candidate-photos')
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' });

      if (uploadError) {
        setError('Could not upload the photo.');
        return;
      }

      const { data } = supabase.storage.from('candidate-photos').getPublicUrl(path);

      // Persist photo_url on the candidate row here so uploads work even
      // before a parent component is wired up to call an onUploaded
      // persistence handler of its own.
      const result = await updateCandidatePhotoAction(candidateId, data.publicUrl);
      if ('error' in result) {
        setError(result.error);
        return;
      }

      onUploaded(data.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label>
        {uploading ? 'Uploading…' : 'Upload photo'}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
