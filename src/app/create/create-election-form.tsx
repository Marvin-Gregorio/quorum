'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createElectionAction } from './actions';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';
import { updateCandidatePhotoAction } from '@/app/manage/[ownerId]/[slug]/actions';
import { colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { CandidateModal, type CandidateDraft } from './candidate-modal';
import { PositionsEditor, type EditablePosition } from './positions-editor';
import { BREADCRUMB_LIST, BREADCRUMB_LINK, TEXT_INPUT, FIELD_LABEL, RADIO_OPTION, RADIO_CHOICE_CLASS, CHIP, CHIP_REMOVE_BTN, PRIMARY_BTN } from '@/lib/ui-classes';

type Candidate = { id: string; name: string; bio: string; photoFile: File | null; previewUrl: string | null };
type Position = { id: string; title: string; candidates: Candidate[] };

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
  const [modalFor, setModalFor] = useState<{ positionId: string; candidateId: string | null } | null>(null);
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

  function saveCandidate(draft: CandidateDraft) {
    if (!modalFor) return;
    const { positionId, candidateId } = modalFor;
    setPositions(
      positions.map((pos) => {
        if (pos.id !== positionId) return pos;
        if (candidateId) {
          return {
            ...pos,
            candidates: pos.candidates.map((c) => (c.id === candidateId ? { ...c, ...draft } : c)),
          };
        }
        return { ...pos, candidates: [...pos.candidates, { id: newLocalId(), ...draft }] };
      })
    );
    setModalFor(null);
  }

  function deleteCandidateFromModal() {
    if (!modalFor) return;
    const { positionId, candidateId } = modalFor;
    setPositions(
      positions.map((pos) =>
        pos.id === positionId ? { ...pos, candidates: pos.candidates.filter((c) => c.id !== candidateId) } : pos
      )
    );
    setModalFor(null);
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

  const editablePositions: EditablePosition[] = positions.map((p) => ({
    id: p.id,
    title: p.title,
    candidates: p.candidates.map((c) => ({ id: c.id, name: c.name, bio: c.bio, previewUrl: c.previewUrl })),
  }));

  const modalCandidate = modalFor
    ? positions.find((p) => p.id === modalFor.positionId)?.candidates.find((c) => c.id === modalFor.candidateId)
    : undefined;
  const modalPositionCandidateCount = modalFor
    ? (positions.find((p) => p.id === modalFor.positionId)?.candidates.length ?? 0)
    : 0;

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

        <PositionsEditor
          positions={editablePositions}
          onTitleChange={updatePositionTitle}
          onDeletePosition={deletePosition}
          onAddPosition={addPosition}
          onOpenAddCandidate={(positionId) => setModalFor({ positionId, candidateId: null })}
          onOpenEditCandidate={(positionId, candidateId) => setModalFor({ positionId, candidateId })}
        />

        <div className="border-t border-line mt-8 pt-8 flex justify-end">
          <button type="submit" className={cn(PRIMARY_BTN, 'px-8 py-[14px] text-base')} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create election'}
          </button>
        </div>
      </form>

      {modalFor && (
        <CandidateModal
          isEditing={modalFor.candidateId !== null}
          colorClass={colorClassForIndex(
            modalFor.candidateId
              ? (positions.find((p) => p.id === modalFor.positionId)?.candidates.findIndex((c) => c.id === modalFor.candidateId) ?? 0)
              : modalPositionCandidateCount
          )}
          initial={{
            name: modalCandidate?.name ?? '',
            bio: modalCandidate?.bio ?? '',
            photoFile: modalCandidate?.photoFile ?? null,
            previewUrl: modalCandidate?.previewUrl ?? null,
          }}
          onSave={saveCandidate}
          onDelete={deleteCandidateFromModal}
          onClose={() => setModalFor(null)}
        />
      )}
    </>
  );
}
