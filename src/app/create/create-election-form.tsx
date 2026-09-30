'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createElectionAction } from './actions';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';
import { updateCandidatePhotoAction } from '@/app/manage/[ownerId]/[slug]/actions';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import {
  BREADCRUMB_LIST,
  BREADCRUMB_LINK,
  TEXT_INPUT,
  FIELD_LABEL,
  RADIO_OPTION,
  RADIO_CHOICE_CLASS,
  CHIP,
  CHIP_REMOVE_BTN,
  CANDIDATE_ROW,
  MODAL_OVERLAY,
  MODAL_PANEL,
  PRIMARY_BTN,
  SECONDARY_BTN,
  avatarClass,
  avatarImgClass,
} from '@/lib/ui-classes';

type Candidate = { id: string; name: string; bio: string; photoFile: File | null; previewUrl: string | null };
type Position = { id: string; title: string; candidates: Candidate[] };
type Modal = { positionId: string; candidateId: string | null; name: string; bio: string; colorClass: string; photoFile: File | null; previewUrl: string | null };

let nextId = 1;
function newLocalId() {
  return `local-${nextId++}`;
}

export function CreateElectionForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [title, setTitle] = useState('');
  const [votingStartsAt, setVotingStartsAt] = useState('');
  const [votingEndsAt, setVotingEndsAt] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addDomain() {
    const value = domainInput.trim().toLowerCase();
    if (!value || domains.includes(value)) return;
    setDomains([...domains, value]);
    setDomainInput('');
  }

  function removeDomain(domain: string) {
    setDomains(domains.filter((d) => d !== domain));
  }

  function addPosition() {
    setPositions([...positions, { id: newLocalId(), title: '', candidates: [] }]);
  }

  function updatePositionTitle(positionId: string, value: string) {
    setPositions(positions.map((p) => (p.id === positionId ? { ...p, title: value } : p)));
  }

  function deletePosition(positionId: string) {
    setPositions(positions.filter((p) => p.id !== positionId));
  }

  function openAddCandidate(positionId: string) {
    const pos = positions.find((p) => p.id === positionId)!;
    setModal({
      positionId,
      candidateId: null,
      name: '',
      bio: '',
      colorClass: colorClassForIndex(pos.candidates.length),
      photoFile: null,
      previewUrl: null,
    });
  }

  function openEditCandidate(positionId: string, candidateId: string) {
    const pos = positions.find((p) => p.id === positionId)!;
    const cand = pos.candidates.find((c) => c.id === candidateId)!;
    setModal({
      positionId,
      candidateId,
      name: cand.name,
      bio: cand.bio,
      colorClass: colorClassForIndex(pos.candidates.findIndex((c) => c.id === candidateId)),
      photoFile: cand.photoFile,
      previewUrl: cand.previewUrl,
    });
  }

  function closeModal() {
    setModal(null);
  }

  function onModalPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !modal) return;
    const previewUrl = URL.createObjectURL(file);
    setModal({ ...modal, photoFile: file, previewUrl });
  }

  function saveCandidate() {
    if (!modal) return;
    const { positionId, candidateId, name, bio, photoFile, previewUrl } = modal;
    setPositions(
      positions.map((pos) => {
        if (pos.id !== positionId) return pos;
        if (candidateId) {
          return {
            ...pos,
            candidates: pos.candidates.map((c) =>
              c.id === candidateId ? { ...c, name, bio, photoFile, previewUrl } : c
            ),
          };
        }
        return {
          ...pos,
          candidates: [...pos.candidates, { id: newLocalId(), name, bio, photoFile, previewUrl }],
        };
      })
    );
    setModal(null);
  }

  function deleteCandidateFromModal() {
    if (!modal) return;
    const { positionId, candidateId } = modal;
    setPositions(
      positions.map((pos) =>
        pos.id === positionId ? { ...pos, candidates: pos.candidates.filter((c) => c.id !== candidateId) } : pos
      )
    );
    setModal(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!votingStartsAt || !votingEndsAt) {
      setError('Please set both an opening and closing date/time for voting.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await createElectionAction({
        organizationName,
        title,
        votingStartsAt: new Date(votingStartsAt).toISOString(),
        votingEndsAt: new Date(votingEndsAt).toISOString(),
        isPrivate,
        domains,
        positions: positions.map((p) => ({
          title: p.title,
          candidates: p.candidates.map((c) => ({ name: c.name, bio: c.bio })),
        })),
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Positions/candidates come back in the same order they were sent, so
      // pair them up by index to find each candidate's real id and upload
      // any photo picked during creation now that a row exists to attach it to.
      const supabase = createBrowserSupabaseClient();
      for (const [pi, localPos] of positions.entries()) {
        const createdPos = result.positions[pi];
        if (!createdPos) continue;
        for (const [ci, localCand] of localPos.candidates.entries()) {
          const createdCand = createdPos.candidates[ci];
          if (!createdCand || !localCand.photoFile) continue;
          const compressed = await compressCandidatePhoto(localCand.photoFile);
          const path = `${result.pageId}/${createdCand.id}.webp`;
          const { error: uploadError } = await supabase.storage
            .from('candidate-photos')
            .upload(path, compressed, { upsert: true, contentType: 'image/webp' });
          if (!uploadError) {
            const { data } = supabase.storage.from('candidate-photos').getPublicUrl(path);
            await updateCandidatePhotoAction(createdCand.id, data.publicUrl);
          }
        }
      }

      router.push(`/manage/${result.ownerId}/${result.slug}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="max-w-[640px] w-full mx-auto pt-4 px-6 pb-0">
        <ol className={BREADCRUMB_LIST}>
          <li>
            <Link href="/" className={BREADCRUMB_LINK}>Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            Create election
          </li>
        </ol>
      </nav>

      <form
        onSubmit={handleSubmit}
        className="max-w-[640px] w-full mx-auto px-6 pt-6 pb-24 grow"
      >
        <h1 className="text-[clamp(26px,4vw,32px)] mb-8">Create an election</h1>

        {error && (
          <p role="alert" className="text-seal-dark text-sm mb-4">
            {error}
          </p>
        )}

        <div>
          <label className={FIELD_LABEL} htmlFor="org-name">
            Organization name
          </label>
          <input
            className={TEXT_INPUT}
            id="org-name"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
          <p className="text-[13px] text-ink-2 mt-2 mb-0">
            Shown above the election title everywhere voters and viewers see it — reuse the same name across
            elections for the same organization.
          </p>
        </div>

        <div className="border-t border-line mt-8 pt-8">
          <label className={FIELD_LABEL} htmlFor="title">
            Election title
          </label>
          <input className={TEXT_INPUT} id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="border-t border-line mt-8 pt-8 flex gap-4 flex-wrap">
          <div className="flex-[1_1_200px]">
            <label className={FIELD_LABEL} htmlFor="opens">
              Opens
            </label>
            <input
              className={TEXT_INPUT}
              id="opens"
              type="datetime-local"
              value={votingStartsAt}
              onChange={(e) => setVotingStartsAt(e.target.value)}
            />
          </div>
          <div className="flex-[1_1_200px]">
            <label className={FIELD_LABEL} htmlFor="closes">
              Closes
            </label>
            <input
              className={TEXT_INPUT}
              id="closes"
              type="datetime-local"
              value={votingEndsAt}
              onChange={(e) => setVotingEndsAt(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[13px] text-ink-2 mt-2.5 mb-0">
          Once voting opens, positions and candidates can no longer be added or removed — only edited.
        </p>

        <div className="border-t border-line mt-8 pt-8">
          <fieldset>
            <legend>Who can vote</legend>
            <label className={RADIO_OPTION}>
              <input type="radio" name="visibility" className={RADIO_CHOICE_CLASS} checked={!isPrivate} onChange={() => setIsPrivate(false)} />
              <span>Anyone with a Google or Microsoft account</span>
            </label>
            <label className={RADIO_OPTION}>
              <input type="radio" name="visibility" className={RADIO_CHOICE_CLASS} checked={isPrivate} onChange={() => setIsPrivate(true)} />
              <span>Only people with a specific email domain</span>
            </label>
          </fieldset>
          {isPrivate && (
            <div className="mt-3 pl-7">
              <div className="flex gap-2 flex-wrap items-center mb-3">
                {domains.map((domain) => (
                  <span className={CHIP} key={domain}>
                    {domain}
                    <button type="button" className={CHIP_REMOVE_BTN} onClick={() => removeDomain(domain)} aria-label={`Remove ${domain}`}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={TEXT_INPUT}
                  type="text"
                  placeholder="Add a domain, e.g. riverside.coop"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDomain();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addDomain}
                  className="border border-ink bg-transparent rounded-[3px] px-[18px] py-0 text-sm cursor-pointer whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line mt-8 pt-8">
          <h2 className="text-xl mb-1">Positions &amp; candidates</h2>
          <p className="text-[13px] text-ink-2 m-0 mb-5">
            Deleting a position also deletes its candidates.
          </p>

          {positions.map((pos) => (
            <div className="border-t border-line pt-7 mt-7" key={pos.id}>
              <div className="flex justify-between items-end gap-4 mb-4">
                <div className="grow">
                  <label className={FIELD_LABEL}>Position title</label>
                  <input
                    className={TEXT_INPUT}
                    type="text"
                    value={pos.title}
                    onChange={(e) => updatePositionTitle(pos.id, e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="bg-transparent border-none text-seal-dark text-[13px] cursor-pointer underline underline-offset-2 whitespace-nowrap pb-[11px]"
                  onClick={() => deletePosition(pos.id)}
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
                          <img src={cand.previewUrl} alt="" className={avatarImgClass('sm')} />
                        ) : (
                          <div className={cn(avatarClass('sm'), colorClassForIndex(ci))}>
                            {initialsFor(cand.name)}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{cand.name || 'Untitled candidate'}</div>
                          {cand.bio && (
                            <div className="text-ink-2 text-[13px] leading-[1.5] mt-0.5">
                              {cand.bio}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="bg-transparent border-none text-sm text-ink-2 cursor-pointer underline underline-offset-2"
                        onClick={() => openEditCandidate(pos.id, cand.id)}
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
                onClick={() => openAddCandidate(pos.id)}
              >
                + Add a candidate
              </button>
            </div>
          ))}

          <button
            type="button"
            className="bg-transparent border border-solid border-line-strong rounded-[3px] px-5 py-3 text-sm text-ink cursor-pointer w-full text-left mt-5"
            onClick={addPosition}
          >
            + Add a position
          </button>
        </div>

        <div className="border-t border-line mt-8 pt-8 flex justify-end">
          <button type="submit" className={cn(PRIMARY_BTN, 'px-8 py-[14px] text-base')} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create election'}
          </button>
        </div>
      </form>

      {modal && (
        <div className={MODAL_OVERLAY}>
          <div role="dialog" aria-label="Candidate" className={MODAL_PANEL}>
            <h2 className="text-xl mb-6">{modal.candidateId ? 'Edit candidate' : 'Add a candidate'}</h2>

            <div className="flex items-center gap-4 mb-6">
              {modal.previewUrl ? (
                <img src={modal.previewUrl} alt="" className="w-[72px] h-[72px] rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className={cn(
                    'w-[72px] h-[72px] rounded-full flex items-center justify-center text-paper font-[\'Fraunces\',serif] text-[22px] font-semibold shrink-0',
                    modal.colorClass
                  )}
                >
                  {initialsFor(modal.name)}
                </div>
              )}
              <div>
                <label className="inline-block border border-ink bg-transparent rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink">
                  Upload photo
                  <input className="sr-only" type="file" accept="image/*" onChange={onModalPhotoChange} />
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
              <input
                className={TEXT_INPUT}
                id="m-name"
                type="text"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
              />
            </div>
            <div className="mb-7">
              <label className={FIELD_LABEL} htmlFor="m-bio">
                Platform statement
              </label>
              <textarea
                className={TEXT_INPUT}
                id="m-bio"
                rows={3}
                value={modal.bio}
                onChange={(e) => setModal({ ...modal, bio: e.target.value })}
              />
            </div>

            <div className="flex justify-between items-center">
              {modal.candidateId ? (
                <button
                  type="button"
                  onClick={deleteCandidateFromModal}
                  className="bg-transparent border-none text-seal-dark text-sm cursor-pointer underline underline-offset-2"
                >
                  Delete candidate
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <button type="button" className={SECONDARY_BTN} onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" className={PRIMARY_BTN} onClick={saveCandidate}>
                  Save candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
