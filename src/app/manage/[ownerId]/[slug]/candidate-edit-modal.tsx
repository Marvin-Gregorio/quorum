'use client';

import { useState } from 'react';
import Image from 'next/image';
import { updateCandidateAction } from './actions';
import { CandidatePhotoUpload } from './candidate-photo-upload';
import { initialsFor } from '@/lib/avatar';
import { FIELD_LABEL, TEXT_INPUT, MODAL_OVERLAY, MODAL_PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/lib/ui-classes';

export interface EditableCandidate {
  positionId: string;
  candidateId: string;
  name: string;
  bio: string;
  photoUrl: string | null;
}

export function CandidateEditModal({
  pageId,
  initial,
  onClose,
  onSaved,
}: {
  pageId: string;
  initial: EditableCandidate;
  onClose: () => void;
  onSaved: (candidate: EditableCandidate) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateCandidateAction(initial.candidateId, { name, bio });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onSaved({ ...initial, name, bio, photoUrl });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={MODAL_OVERLAY}>
      <div role="dialog" aria-label="Edit candidate" className={MODAL_PANEL}>
        <h2 className="text-xl mb-6">Edit candidate</h2>
        {error && (
          <p role="alert" className="text-seal-dark text-sm mb-4">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4 mb-6">
          {photoUrl ? (
            <Image src={photoUrl} alt="" width={72} height={72} className="rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-line-strong flex items-center justify-center text-paper font-['Fraunces',serif] text-[22px] font-semibold shrink-0">
              {initialsFor(name)}
            </div>
          )}
          <CandidatePhotoUpload candidateId={initial.candidateId} pageId={pageId} onUploaded={setPhotoUrl} />
        </div>
        <div className="mb-4">
          <label className={FIELD_LABEL} htmlFor="cm-name">
            Name
          </label>
          <input className={TEXT_INPUT} id="cm-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mb-7">
          <label className={FIELD_LABEL} htmlFor="cm-bio">
            Platform statement
          </label>
          <textarea className={TEXT_INPUT} id="cm-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className={SECONDARY_BTN} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={PRIMARY_BTN} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save candidate'}
          </button>
        </div>
      </div>
    </div>
  );
}
