'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';

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
  const supabase = createBrowserSupabaseClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressCandidatePhoto(file);
      const path = `${pageId}/${candidateId}.webp`;
      const { error } = await supabase.storage
        .from('candidate-photos')
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' });

      if (!error) {
        const { data } = supabase.storage.from('candidate-photos').getPublicUrl(path);
        onUploaded(data.publicUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
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
  );
}
