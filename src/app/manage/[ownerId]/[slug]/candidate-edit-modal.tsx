'use client';

import { useState } from 'react';
import Image from 'next/image';
import { updateCandidateAction } from './actions';
import { CandidatePhotoUpload } from './candidate-photo-upload';
import { useFeedback } from '@/components/feedback-provider';
import { initialsFor } from '@/lib/avatar';
import { candidateSchema } from '@/lib/validation';
import { parseInput } from '@/lib/validate-input';
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
  const { showError, showSuccess } = useFeedback();

  async function save() {
    const parsed = parseInput(candidateSchema, { name, bio });
    if ('error' in parsed) {
      showError(parsed.error, 'Candidate not saved');
      return;
    }
    setSaving(true);
    try {
      const result = await updateCandidateAction(initial.candidateId, parsed.data);
      if ('error' in result) {
        showError(result.error, 'Candidate not saved');
        return;
      }
      showSuccess('Candidate updated.');
      onSaved({ ...initial, ...parsed.data, photoUrl });
    } catch {
      showError('Something went wrong. Please try again.', 'Candidate not saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={MODAL_OVERLAY}>
      <div role="dialog" aria-label="Edit candidate" className={MODAL_PANEL}>
        <h2 className="text-xl mb-6">Edit candidate</h2>
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
