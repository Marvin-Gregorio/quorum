'use client';

import { useState } from 'react';
import Image from 'next/image';
import { initialsFor } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { FIELD_LABEL, TEXT_INPUT, MODAL_OVERLAY, MODAL_PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/lib/ui-classes';

export interface CandidateDraft {
  name: string;
  bio: string;
  photoFile: File | null;
  previewUrl: string | null;
}

export function CandidateModal({
  isEditing,
  colorClass,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  isEditing: boolean;
  colorClass: string;
  initial: CandidateDraft;
  onSave: (draft: CandidateDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [photoFile, setPhotoFile] = useState(initial.photoFile);
  const [previewUrl, setPreviewUrl] = useState(initial.previewUrl);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className={MODAL_OVERLAY}>
      <div role="dialog" aria-label="Candidate" className={MODAL_PANEL}>
        <h2 className="text-xl mb-6">{isEditing ? 'Edit candidate' : 'Add a candidate'}</h2>

        <div className="flex items-center gap-4 mb-6">
          {previewUrl ? (
            <Image src={previewUrl} alt="candidate profile pic" className="w-[72px] h-[72px] rounded-full object-cover shrink-0" />
          ) : (
            <div
              className={cn(
                "w-[72px] h-[72px] rounded-full flex items-center justify-center text-paper font-['Fraunces',serif] text-[22px] font-semibold shrink-0",
                colorClass
              )}
            >
              {initialsFor(name)}
            </div>
          )}
          <div>
            <label className="inline-block border border-ink bg-transparent rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink">
              Upload photo
              <input className="sr-only" type="file" accept="image/*" onChange={onPhotoChange} />
            </label>
            <p className="text-xs text-ink-2 mt-2 mb-0 leading-[1.5] max-w-[26ch]">
              Resized and compressed automatically before upload.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className={FIELD_LABEL} htmlFor="m-name">
            Name
          </label>
          <input className={TEXT_INPUT} id="m-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mb-7">
          <label className={FIELD_LABEL} htmlFor="m-bio">
            Platform statement
          </label>
          <textarea className={TEXT_INPUT} id="m-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <div className="flex justify-between items-center">
          {isEditing ? (
            <button
              type="button"
              onClick={onDelete}
              className="bg-transparent border-none text-seal-dark text-sm cursor-pointer underline underline-offset-2"
            >
              Delete candidate
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" className={SECONDARY_BTN} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={() => onSave({ name, bio, photoFile, previewUrl })}>
              Save candidate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
