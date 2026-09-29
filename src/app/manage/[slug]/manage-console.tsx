'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { updateElectionSettingsAction, updateCandidateAction } from './actions';
import { CandidatePhotoUpload } from './candidate-photo-upload';
import { initialsFor, colorForIndex } from '@/lib/avatar';
import { toRoman } from '@/lib/roman';

export interface Tally {
  positionId: string;
  candidateId: string;
  voteCount: number;
}

export interface Turnout {
  positionId: string;
  voterId: string;
}

interface Candidate {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
}

interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageConsole({
  pageId,
  slug,
  organizationName: initialOrgName,
  title: initialTitle,
  votingStartsAt: initialStartsAt,
  votingEndsAt: initialEndsAt,
  isPrivate: initialIsPrivate,
  domains: initialDomains,
  positions: initialPositions,
  positionIds,
  initialTallies,
  initialTurnout,
}: {
  pageId: string;
  slug: string;
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
  positions: Position[];
  positionIds: string[];
  initialTallies: Tally[];
  initialTurnout: Turnout[];
}) {
  const [organizationName, setOrganizationName] = useState(initialOrgName);
  const [title, setTitle] = useState(initialTitle);
  const [votingStartsAt, setVotingStartsAt] = useState(initialStartsAt);
  const [votingEndsAt, setVotingEndsAt] = useState(initialEndsAt);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [domains, setDomains] = useState(initialDomains);
  const [positions, setPositions] = useState(initialPositions);

  const [tallies, setTallies] = useState(initialTallies);
  const [turnout, setTurnout] = useState(initialTurnout);

  const [candidateModal, setCandidateModal] = useState<{ positionId: string; candidateId: string; name: string; bio: string; photoUrl: string | null } | null>(null);
  const [candidateSaving, setCandidateSaving] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  const [settingsModal, setSettingsModal] = useState<{
    orgName: string;
    title: string;
    opens: string;
    closes: string;
    isPrivate: boolean;
    domains: string[];
    domainInput: string;
  } | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState<'ballot' | 'results' | null>(null);

  // vote_tallies rows don't carry page_id directly (only position_id), so
  // the Realtime subscription is filtered server-side with an `in.(...)`
  // filter over this page's own position ids. voter_turnout does carry
  // page_id directly, so it's filtered server-side on that column instead.
  // Both are still re-checked client-side against this same position id set
  // as a defence-in-depth belt-and-braces check (and to guard against a
  // stale/empty positionIds prop on first render). This set comes from the
  // page's full, server-fetched position list (not derived from
  // initialTallies/initialTurnout), so a position with zero votes/turnout so
  // far — newly added, or just hasn't received its first vote yet — is
  // still included and its first live vote isn't silently dropped.
  const positionIdSet = useMemo(() => new Set(positionIds), [positionIds]);

  useEffect(() => {
    if (positionIds.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const positionIdFilter = `position_id=in.(${positionIds.join(',')})`;
    const channel = supabase
      .channel(`manage-${pageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vote_tallies', filter: positionIdFilter },
        (payload) => {
          const row = payload.new as { position_id: string; candidate_id: string; vote_count: number };
          if (!positionIdSet.has(row.position_id)) return;
          setTallies((prev) => {
            const next = prev.filter((t) => !(t.positionId === row.position_id && t.candidateId === row.candidate_id));
            next.push({ positionId: row.position_id, candidateId: row.candidate_id, voteCount: row.vote_count });
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voter_turnout', filter: `page_id=eq.${pageId}` },
        (payload) => {
          const row = payload.new as { position_id: string; voter_id: string };
          if (!positionIdSet.has(row.position_id)) return;
          setTurnout((prev) => {
            if (prev.some((t) => t.positionId === row.position_id && t.voterId === row.voter_id)) return prev;
            return [...prev, { positionId: row.position_id, voterId: row.voter_id }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, positionIds, positionIdSet]);

  function turnoutFor(positionId: string): number {
    return turnout.filter((t) => t.positionId === positionId).length;
  }

  void tallies; // reserved for a future per-candidate vote count view on this console; secrecy rules keep it out for now

  function openCandidateModal(positionId: string, candidateId: string) {
    const pos = positions.find((p) => p.id === positionId)!;
    const cand = pos.candidates.find((c) => c.id === candidateId)!;
    setCandidateError(null);
    setCandidateModal({ positionId, candidateId, name: cand.name, bio: cand.bio, photoUrl: cand.photoUrl });
  }

  async function saveCandidateModal() {
    if (!candidateModal) return;
    setCandidateSaving(true);
    setCandidateError(null);
    try {
      const result = await updateCandidateAction(candidateModal.candidateId, {
        name: candidateModal.name,
        bio: candidateModal.bio,
      });
      if ('error' in result) {
        setCandidateError(result.error);
        return;
      }
      setPositions((prev) =>
        prev.map((pos) =>
          pos.id !== candidateModal.positionId
            ? pos
            : {
                ...pos,
                candidates: pos.candidates.map((c) =>
                  c.id === candidateModal.candidateId
                    ? { ...c, name: candidateModal.name, bio: candidateModal.bio, photoUrl: candidateModal.photoUrl }
                    : c
                ),
              }
        )
      );
      setCandidateModal(null);
    } finally {
      setCandidateSaving(false);
    }
  }

  function openSettingsModal() {
    setSettingsError(null);
    setSettingsModal({
      orgName: organizationName,
      title,
      opens: toDatetimeLocal(votingStartsAt),
      closes: toDatetimeLocal(votingEndsAt),
      isPrivate,
      domains: [...domains],
      domainInput: '',
    });
  }

  async function saveSettingsModal() {
    if (!settingsModal) return;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const result = await updateElectionSettingsAction(pageId, {
        organizationName: settingsModal.orgName,
        title: settingsModal.title,
        votingStartsAt: new Date(settingsModal.opens).toISOString(),
        votingEndsAt: new Date(settingsModal.closes).toISOString(),
        isPrivate: settingsModal.isPrivate,
        domains: settingsModal.domains,
      });
      if ('error' in result) {
        setSettingsError(result.error);
        return;
      }
      setOrganizationName(settingsModal.orgName);
      setTitle(settingsModal.title);
      setVotingStartsAt(new Date(settingsModal.opens).toISOString());
      setVotingEndsAt(new Date(settingsModal.closes).toISOString());
      setIsPrivate(settingsModal.isPrivate);
      setDomains(settingsModal.domains);
      setSettingsModal(null);
    } finally {
      setSettingsSaving(false);
    }
  }

  function addSettingsDomain() {
    if (!settingsModal) return;
    const value = settingsModal.domainInput.trim().toLowerCase();
    if (!value || settingsModal.domains.includes(value)) return;
    setSettingsModal({ ...settingsModal, domains: [...settingsModal.domains, value], domainInput: '' });
  }

  function removeSettingsDomain(domain: string) {
    if (!settingsModal) return;
    setSettingsModal({ ...settingsModal, domains: settingsModal.domains.filter((d) => d !== domain) });
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ballotUrl = `${origin}/vote/${slug}`;
  const resultsUrl = `${origin}/results/${slug}`;

  async function copyLink(kind: 'ballot' | 'results', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLink(kind);
      setTimeout(() => setCopiedLink(null), 1500);
    } catch {
      // Clipboard access can be denied by the browser; the link text is
      // still selectable manually, so there's nothing further to recover.
    }
  }

  const privacyLabel = isPrivate ? `Private to ${domains.join(', ') || 'no domains yet'}` : 'Public';
  const now = Date.now();
  const opensAtMs = new Date(votingStartsAt).getTime();
  const closesAtMs = new Date(votingEndsAt).getTime();
  const statusLine =
    now < opensAtMs
      ? `Opens ${formatDateTime(votingStartsAt)}, closes ${formatDateTime(votingEndsAt)}.`
      : now > closesAtMs
        ? `Closed. Voting ran from ${formatDateTime(votingStartsAt)} through ${formatDateTime(votingEndsAt)}.`
        : `Open now, from ${formatDateTime(votingStartsAt)} through ${formatDateTime(votingEndsAt)}.`;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '24px 24px 64px', flexGrow: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 4px' }}>{organizationName}</p>
          <h1 style={{ fontSize: 'clamp(26px,4vw,32px)', margin: '0 0 8px' }}>{title}</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>{statusLine}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="status-badge status-neutral">{privacyLabel}</span>
          <button type="button" className="settings-btn" onClick={openSettingsModal}>
            Edit settings
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 28 }}>
        <div className="link-row" style={{ flex: '1 1 320px' }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>Ballot link</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={ballotUrl} />
            <button type="button" onClick={() => copyLink('ballot', ballotUrl)}>
              {copiedLink === 'ballot' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="link-row" style={{ flex: '1 1 320px' }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>Results link</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={resultsUrl} />
            <button type="button" onClick={() => copyLink('results', resultsUrl)}>
              {copiedLink === 'results' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <p style={{ margin: '28px 0 0', padding: '12px 16px', background: 'var(--paper-2)', borderRadius: 3, fontSize: 13, color: 'var(--ink-2)' }}>
        Positions and candidates are locked once voting opens. You can still edit an existing candidate&apos;s name, bio, or photo below.
      </p>

      {positions.map((pos, pi) => (
        <div key={pos.id} style={{ borderTop: '1px solid var(--line)', marginTop: 32, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 18, color: 'var(--ink-2)' }}>
                {toRoman(pi + 1)}.
              </span>
              <h2 style={{ fontSize: 22 }}>{pos.title}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-2)' }}>
              <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false">
                <line x1="2" y1="2" x2="2" y2="14" stroke="var(--ink-2)" strokeWidth="2" />
                <line x1="7" y1="2" x2="7" y2="14" stroke="var(--ink-2)" strokeWidth="2" />
                <line x1="12" y1="2" x2="12" y2="14" stroke="var(--ink-2)" strokeWidth="2" />
                <line x1="17" y1="2" x2="17" y2="14" stroke="var(--ink-2)" strokeWidth="2" />
                <line x1="0" y1="14" x2="19" y2="2" stroke="var(--ink-2)" strokeWidth="2" />
              </svg>
              {turnoutFor(pos.id)} people have voted
            </div>
          </div>
          <div>
            {pos.candidates.map((cand, ci) => (
              <div className="candidate-row" key={cand.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    className="avatar"
                    style={{
                      background: colorForIndex(ci),
                      backgroundImage: cand.photoUrl ? `url(${cand.photoUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!cand.photoUrl && initialsFor(cand.name)}
                  </div>
                  <span style={{ fontWeight: 500 }}>{cand.name}</span>
                </div>
                <button type="button" className="edit-link" onClick={() => openCandidateModal(pos.id, cand.id)}>
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {candidateModal && (
        <div className="modal-overlay">
          <div role="dialog" aria-label="Edit candidate" className="modal-panel">
            <h2 style={{ fontSize: 20, marginBottom: 24 }}>Edit candidate</h2>
            {candidateError && (
              <p role="alert" style={{ color: 'var(--seal-dark)', fontSize: 14, marginBottom: 16 }}>
                {candidateError}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'var(--line-strong)',
                  backgroundImage: candidateModal.photoUrl ? `url(${candidateModal.photoUrl})` : undefined,
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
                {!candidateModal.photoUrl && initialsFor(candidateModal.name)}
              </div>
              <CandidatePhotoUpload
                candidateId={candidateModal.candidateId}
                pageId={pageId}
                onUploaded={(url) => setCandidateModal({ ...candidateModal, photoUrl: url })}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" htmlFor="cm-name">
                Name
              </label>
              <input
                className="text-input"
                id="cm-name"
                type="text"
                value={candidateModal.name}
                onChange={(e) => setCandidateModal({ ...candidateModal, name: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label className="field-label" htmlFor="cm-bio">
                Platform statement
              </label>
              <textarea
                className="text-input"
                id="cm-bio"
                rows={3}
                value={candidateModal.bio}
                onChange={(e) => setCandidateModal({ ...candidateModal, bio: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="secondary-btn" onClick={() => setCandidateModal(null)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={saveCandidateModal} disabled={candidateSaving}>
                {candidateSaving ? 'Saving…' : 'Save candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsModal && (
        <div className="modal-overlay">
          <div role="dialog" aria-label="Election settings" className="modal-panel wide">
            <h2 style={{ fontSize: 20, marginBottom: 24 }}>Election settings</h2>
            {settingsError && (
              <p role="alert" style={{ color: 'var(--seal-dark)', fontSize: 14, marginBottom: 16 }}>
                {settingsError}
              </p>
            )}
            <div style={{ marginBottom: 20 }}>
              <label className="field-label" htmlFor="sm-org">
                Organization name
              </label>
              <input
                className="text-input"
                id="sm-org"
                type="text"
                value={settingsModal.orgName}
                onChange={(e) => setSettingsModal({ ...settingsModal, orgName: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="field-label" htmlFor="sm-title">
                Election title
              </label>
              <input
                className="text-input"
                id="sm-title"
                type="text"
                value={settingsModal.title}
                onChange={(e) => setSettingsModal({ ...settingsModal, title: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="field-label" htmlFor="sm-opens">
                  Opens
                </label>
                <input
                  className="text-input"
                  id="sm-opens"
                  type="datetime-local"
                  value={settingsModal.opens}
                  onChange={(e) => setSettingsModal({ ...settingsModal, opens: e.target.value })}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="field-label" htmlFor="sm-closes">
                  Closes
                </label>
                <input
                  className="text-input"
                  id="sm-closes"
                  type="datetime-local"
                  value={settingsModal.closes}
                  onChange={(e) => setSettingsModal({ ...settingsModal, closes: e.target.value })}
                />
              </div>
            </div>

            <fieldset style={{ marginBottom: 12 }}>
              <legend>Who can vote</legend>
              <label className="radio-option">
                <input
                  type="radio"
                  name="sm-visibility"
                  className="choice"
                  checked={!settingsModal.isPrivate}
                  onChange={() => setSettingsModal({ ...settingsModal, isPrivate: false })}
                />
                <span>Anyone with a Google or Microsoft account</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="sm-visibility"
                  className="choice"
                  checked={settingsModal.isPrivate}
                  onChange={() => setSettingsModal({ ...settingsModal, isPrivate: true })}
                />
                <span>Only people with a specific email domain</span>
              </label>
            </fieldset>

            {settingsModal.isPrivate && (
              <div style={{ marginBottom: 28, paddingLeft: 28 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  {settingsModal.domains.map((domain) => (
                    <span className="chip" key={domain}>
                      {domain}
                      <button type="button" onClick={() => removeSettingsDomain(domain)} aria-label={`Remove ${domain}`}>
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
                    value={settingsModal.domainInput}
                    onChange={(e) => setSettingsModal({ ...settingsModal, domainInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSettingsDomain();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addSettingsDomain}
                    style={{ border: '1px solid var(--ink)', background: 'none', borderRadius: 3, padding: '0 18px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="secondary-btn" onClick={() => setSettingsModal(null)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={saveSettingsModal} disabled={settingsSaving}>
                {settingsSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
