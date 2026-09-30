'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createElectionAction } from './actions';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressCandidatePhoto } from '@/lib/image-compression';
import { updateCandidatePhotoAction } from '@/app/manage/[ownerId]/[slug]/actions';
import { initialsFor, colorForIndex } from '@/lib/avatar';

type Candidate = { id: string; name: string; bio: string; photoFile: File | null; previewUrl: string | null };
type Position = { id: string; title: string; candidates: Candidate[] };
type Modal = { positionId: string; candidateId: string | null; name: string; bio: string; color: string; photoFile: File | null; previewUrl: string | null };

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
      color: colorForIndex(pos.candidates.length),
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
      color: colorForIndex(pos.candidates.findIndex((c) => c.id === candidateId)),
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
      <nav aria-label="Breadcrumb" style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '16px 24px 0' }}>
        <ol className="breadcrumb-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--ink)' }}>
            Create election
          </li>
        </ol>
      </nav>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '24px 24px 96px', flexGrow: 1 }}
      >
        <h1 style={{ fontSize: 'clamp(26px,4vw,32px)', marginBottom: 32 }}>Create an election</h1>

        {error && (
          <p role="alert" style={{ color: 'var(--seal-dark)', fontSize: 14, marginBottom: 16 }}>
            {error}
          </p>
        )}

        <div>
          <label className="field-label" htmlFor="org-name">
            Organization name
          </label>
          <input
            className="text-input"
            id="org-name"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '8px 0 0' }}>
            Shown above the election title everywhere voters and viewers see it — reuse the same name across
            elections for the same organization.
          </p>
        </div>

        <div className="section">
          <label className="field-label" htmlFor="title">
            Election title
          </label>
          <input className="text-input" id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="section" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="field-label" htmlFor="opens">
              Opens
            </label>
            <input
              className="text-input"
              id="opens"
              type="datetime-local"
              value={votingStartsAt}
              onChange={(e) => setVotingStartsAt(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="field-label" htmlFor="closes">
              Closes
            </label>
            <input
              className="text-input"
              id="closes"
              type="datetime-local"
              value={votingEndsAt}
              onChange={(e) => setVotingEndsAt(e.target.value)}
            />
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '10px 0 0' }}>
          Once voting opens, positions and candidates can no longer be added or removed — only edited.
        </p>

        <div className="section">
          <fieldset>
            <legend>Who can vote</legend>
            <label className="radio-option">
              <input type="radio" name="visibility" className="choice" checked={!isPrivate} onChange={() => setIsPrivate(false)} />
              <span>Anyone with a Google or Microsoft account</span>
            </label>
            <label className="radio-option">
              <input type="radio" name="visibility" className="choice" checked={isPrivate} onChange={() => setIsPrivate(true)} />
              <span>Only people with a specific email domain</span>
            </label>
          </fieldset>
          {isPrivate && (
            <div style={{ marginTop: 12, paddingLeft: 28 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                {domains.map((domain) => (
                  <span className="chip" key={domain}>
                    {domain}
                    <button type="button" onClick={() => removeDomain(domain)} aria-label={`Remove ${domain}`}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="text-input"
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
                  style={{
                    border: '1px solid var(--ink)',
                    background: 'none',
                    borderRadius: 3,
                    padding: '0 18px',
                    fontSize: 14,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="section">
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Positions &amp; candidates</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 20px' }}>
            Deleting a position also deletes its candidates.
          </p>

          {positions.map((pos) => (
            <div className="position-block" key={pos.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 16 }}>
                <div style={{ flexGrow: 1 }}>
                  <label className="field-label">Position title</label>
                  <input
                    className="text-input"
                    type="text"
                    value={pos.title}
                    onChange={(e) => updatePositionTitle(pos.id, e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="delete-position-btn"
                  onClick={() => deletePosition(pos.id)}
                  style={{ paddingBottom: 11 }}
                >
                  Delete position
                </button>
              </div>

              {pos.candidates.length > 0 ? (
                <div>
                  {pos.candidates.map((cand, ci) => (
                    <div className="candidate-row" key={cand.id} style={{ alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div
                          className="avatar-sm"
                          style={{
                            background: colorForIndex(ci),
                            backgroundImage: cand.previewUrl ? `url(${cand.previewUrl})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {!cand.previewUrl && initialsFor(cand.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{cand.name || 'Untitled candidate'}</div>
                          {cand.bio && (
                            <div style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>
                              {cand.bio}
                            </div>
                          )}
                        </div>
                      </div>
                      <button type="button" className="edit-link" onClick={() => openEditCandidate(pos.id, cand.id)}>
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-candidates">No candidates yet.</p>
              )}

              <button type="button" className="dashed-btn" onClick={() => openAddCandidate(pos.id)} style={{ marginTop: 12 }}>
                + Add a candidate
              </button>
            </div>
          ))}

          <button
            type="button"
            className="dashed-btn"
            onClick={addPosition}
            style={{ marginTop: 20, borderStyle: 'solid', color: 'var(--ink)' }}
          >
            + Add a position
          </button>
        </div>

        <div className="section" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="primary-btn" style={{ padding: '14px 32px', fontSize: 16 }} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create election'}
          </button>
        </div>
      </form>

      {modal && (
        <div className="modal-overlay">
          <div role="dialog" aria-label="Candidate" className="modal-panel">
            <h2 style={{ fontSize: 20, marginBottom: 24 }}>{modal.candidateId ? 'Edit candidate' : 'Add a candidate'}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: modal.color,
                  backgroundImage: modal.previewUrl ? `url(${modal.previewUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--paper)',
                  fontFamily: "'Fraunces', serif",
                  fontSize: 22,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {!modal.previewUrl && initialsFor(modal.name)}
              </div>
              <div>
                <label className="upload-btn">
                  Upload photo
                  <input className="visually-hidden" type="file" accept="image/*" onChange={onModalPhotoChange} />
                </label>
                <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '8px 0 0', lineHeight: 1.5, maxWidth: '26ch' }}>
                  Resized and compressed automatically before upload.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label" htmlFor="m-name">
                Name
              </label>
              <input
                className="text-input"
                id="m-name"
                type="text"
                value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label className="field-label" htmlFor="m-bio">
                Platform statement
              </label>
              <textarea
                className="text-input"
                id="m-bio"
                rows={3}
                value={modal.bio}
                onChange={(e) => setModal({ ...modal, bio: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {modal.candidateId ? (
                <button
                  type="button"
                  onClick={deleteCandidateFromModal}
                  style={{ background: 'none', border: 'none', color: 'var(--seal-dark)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  Delete candidate
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="secondary-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button type="button" className="primary-btn" onClick={saveCandidate}>
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
