'use client';

import Image from 'next/image';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { FIELD_LABEL, TEXT_INPUT, CANDIDATE_ROW, avatarClass, avatarImgClass } from '@/lib/ui-classes';

export interface EditablePosition {
  id: string;
  title: string;
  candidates: { id: string; name: string; bio: string; previewUrl: string | null }[];
}

export function PositionsEditor({
  positions,
  onTitleChange,
  onDeletePosition,
  onAddPosition,
  onOpenAddCandidate,
  onOpenEditCandidate,
}: {
  positions: EditablePosition[];
  onTitleChange: (positionId: string, value: string) => void;
  onDeletePosition: (positionId: string) => void;
  onAddPosition: () => void;
  onOpenAddCandidate: (positionId: string) => void;
  onOpenEditCandidate: (positionId: string, candidateId: string) => void;
}) {
  return (
    <div className="border-t border-line mt-8 pt-8">
      <h2 className="text-xl mb-1">Positions &amp; candidates</h2>
      <p className="text-[13px] text-ink-2 m-0 mb-5">Deleting a position also deletes its candidates.</p>

      {positions.map((pos) => (
        <div className="border-t border-line pt-7 mt-7" key={pos.id}>
          <div className="flex justify-between items-end gap-4 mb-4">
            <div className="grow">
              <label className={FIELD_LABEL}>Position title</label>
              <input
                className={TEXT_INPUT}
                type="text"
                value={pos.title}
                onChange={(e) => onTitleChange(pos.id, e.target.value)}
              />
            </div>
            <button
              type="button"
              className="bg-transparent border-none text-seal-dark text-[13px] cursor-pointer underline underline-offset-2 whitespace-nowrap pb-[11px]"
              onClick={() => onDeletePosition(pos.id)}
            >
              Delete position
            </button>
          </div>

          {pos.candidates.length > 0 ? (
            <div>
              {pos.candidates.map((cand, ci) => (
                <div className={cn(CANDIDATE_ROW, 'items-start')} key={cand.id}>
                  <div className="flex items-start gap-3.5">
                    {cand.previewUrl ? (
                      <Image src={cand.previewUrl} alt="candidate profile pic" className={avatarImgClass('sm')} />
                    ) : (
                      <div className={cn(avatarClass('sm'), colorClassForIndex(ci))}>{initialsFor(cand.name)}</div>
                    )}
                    <div>
                      <div className="font-medium">{cand.name || 'Untitled candidate'}</div>
                      {cand.bio && <div className="text-ink-2 text-[13px] leading-[1.5] mt-0.5">{cand.bio}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bg-transparent border-none text-sm text-ink-2 cursor-pointer underline underline-offset-2"
                    onClick={() => onOpenEditCandidate(pos.id, cand.id)}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2 py-4 border-t border-line">No candidates yet.</p>
          )}

          <button
            type="button"
            className="bg-transparent border border-dashed border-line-strong rounded-[3px] px-5 py-3 text-sm text-ink-2 cursor-pointer w-full text-left mt-3"
            onClick={() => onOpenAddCandidate(pos.id)}
          >
            + Add a candidate
          </button>
        </div>
      ))}

      <button
        type="button"
        className="bg-transparent border border-solid border-line-strong rounded-[3px] px-5 py-3 text-sm text-ink cursor-pointer w-full text-left mt-5"
        onClick={onAddPosition}
      >
        + Add a position
      </button>
    </div>
  );
}
