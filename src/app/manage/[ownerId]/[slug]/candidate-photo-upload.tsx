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

      // Persist photo_path (not a URL — signed URLs expire, so what's
      // durable is the object path; a fresh signed URL gets generated at
      // render time instead) on the candidate row here so uploads work even
      // before a parent component is wired up to call an onUploaded
      // persistence handler of its own.
      const result = await updateCandidatePhotoAction(candidateId, path);
      if ('error' in result) {
        setError(result.error);
        return;
      }

      // The uploader is always this page's owner, so they always pass
      // can_view_page_content's owner branch — signing their own fresh
      // upload for an immediate preview never fails.
      const { data, error: signError } = await supabase.storage.from('candidate-photos').createSignedUrl(path, 3600);
      if (signError || !data) {
        setError('Photo uploaded, but could not load a preview.');
        return;
      }

      onUploaded(data.signedUrl);
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
          className="sr-only"
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
