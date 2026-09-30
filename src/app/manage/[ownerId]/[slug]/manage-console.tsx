'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { updateElectionSettingsAction, updateCandidateAction } from './actions';
import { CandidatePhotoUpload } from './candidate-photo-upload';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { toRoman } from '@/lib/roman';
import { useLiveVoteTallies, type Tally } from '@/lib/hooks/use-live-vote-tallies';
import {
  STATUS_BADGE_BASE,
  STATUS_BADGE_VARIANT,
  MODAL_OVERLAY,
  MODAL_PANEL,
  MODAL_PANEL_WIDE,
  FIELD_LABEL,
  TEXT_INPUT,
  RADIO_OPTION,
  RADIO_CHOICE_CLASS,
  CHIP,
  CHIP_REMOVE_BTN,
  CANDIDATE_ROW,
  PRIMARY_BTN,
  SECONDARY_BTN,
  avatarClass,
  avatarImgClass,
} from '@/lib/ui-classes';

export type { Tally };

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
  ownerId,
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
  ownerId: string;
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

  const tallies = useLiveVoteTallies({ pageId, positionIds, initialTallies, enabled: true });
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

  // voter_turnout carries page_id directly, so it's filtered server-side on
  // that column. Re-checked client-side against this same position id set as
  // a defence-in-depth belt-and-braces check (and to guard against a
  // stale/empty positionIds prop on first render). This set comes from the
  // page's full, server-fetched position list (not derived from
  // initialTurnout), so a position with zero turnout so far — newly added,
  // or just hasn't received its first vote yet — is still included and its
  // first live vote isn't silently dropped. (vote_tallies has the same
  // shape of guard, inside useLiveVoteTallies.)
  const positionIdSet = useMemo(() => new Set(positionIds), [positionIds]);

  useEffect(() => {
    if (positionIds.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`turnout-${pageId}`)
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
  const ballotUrl = `${origin}/vote/${ownerId}/${slug}`;
  const resultsUrl = `${origin}/results/${ownerId}/${slug}`;

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
    <div className="max-w-[900px] mx-auto w-full px-6 pt-6 pb-16 grow">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="text-sm text-ink-2 m-0 mb-1">{organizationName}</p>
          <h1 className="text-[clamp(26px,4vw,32px)] m-0 mb-2">{title}</h1>
          <p className="text-ink-2 text-sm m-0">{statusLine}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(STATUS_BADGE_BASE, STATUS_BADGE_VARIANT.neutral)}>{privacyLabel}</span>
          <button
            type="button"
            className="bg-transparent border border-ink rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink whitespace-nowrap"
            onClick={openSettingsModal}
          >
            Edit settings
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-wrap mt-7">
        <div className="flex-[1_1_320px]">
          <label className="block text-[13px] text-ink-2 mb-1.5">Ballot link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={ballotUrl}
              className="grow px-3 py-[10px] border border-line-strong rounded-[3px] bg-paper-2 text-sm text-ink"
            />
            <button
              type="button"
              className="border border-ink bg-transparent rounded-[3px] px-4 py-0 text-sm cursor-pointer"
              onClick={() => copyLink('ballot', ballotUrl)}
            >
              {copiedLink === 'ballot' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="flex-[1_1_320px]">
          <label className="block text-[13px] text-ink-2 mb-1.5">Results link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={resultsUrl}
              className="grow px-3 py-[10px] border border-line-strong rounded-[3px] bg-paper-2 text-sm text-ink"
            />
            <button
              type="button"
              className="border border-ink bg-transparent rounded-[3px] px-4 py-0 text-sm cursor-pointer"
              onClick={() => copyLink('results', resultsUrl)}
            >
              {copiedLink === 'results' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-7 mb-0 px-4 py-3 bg-paper-2 rounded-[3px] text-[13px] text-ink-2">
        Positions and candidates are locked once voting opens. You can still edit an existing candidate&apos;s name, bio, or photo below.
      </p>

      {positions.map((pos, pi) => (
        <div key={pos.id} className="border-t border-line mt-8 pt-8">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-5">
            <div className="flex items-baseline gap-3">
              <span className="font-['Fraunces',serif] italic text-lg text-ink-2">
                {toRoman(pi + 1)}.
              </span>
              <h2 className="text-[22px]">{pos.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false">
                <line x1="2" y1="2" x2="2" y2="14" stroke="var(--color-ink-2)" strokeWidth="2" />
                <line x1="7" y1="2" x2="7" y2="14" stroke="var(--color-ink-2)" strokeWidth="2" />
                <line x1="12" y1="2" x2="12" y2="14" stroke="var(--color-ink-2)" strokeWidth="2" />
                <line x1="17" y1="2" x2="17" y2="14" stroke="var(--color-ink-2)" strokeWidth="2" />
                <line x1="0" y1="14" x2="19" y2="2" stroke="var(--color-ink-2)" strokeWidth="2" />
              </svg>
              {turnoutFor(pos.id)} people have voted
            </div>
          </div>
          <div>
            {pos.candidates.map((cand, ci) => (
              <div className={cn(CANDIDATE_ROW, 'items-start')} key={cand.id}>
                <div className="flex items-start gap-3.5">
                  {cand.photoUrl ? (
                    <img src={cand.photoUrl} alt="" className={avatarImgClass('md')} />
                  ) : (
                    <div className={cn(avatarClass('md'), colorClassForIndex(ci))}>
                      {initialsFor(cand.name)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{cand.name}</div>
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
                  onClick={() => openCandidateModal(pos.id, cand.id)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {candidateModal && (
        <div className={MODAL_OVERLAY}>
          <div role="dialog" aria-label="Edit candidate" className={MODAL_PANEL}>
            <h2 className="text-xl mb-6">Edit candidate</h2>
            {candidateError && (
              <p role="alert" className="text-seal-dark text-sm mb-4">
                {candidateError}
              </p>
            )}
            <div className="flex items-center gap-4 mb-6">
              {candidateModal.photoUrl ? (
                <img src={candidateModal.photoUrl} alt="" className="w-[72px] h-[72px] rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-line-strong flex items-center justify-center text-paper font-['Fraunces',serif] text-[22px] font-semibold shrink-0">
                  {initialsFor(candidateModal.name)}
                </div>
              )}
              <CandidatePhotoUpload
                candidateId={candidateModal.candidateId}
                pageId={pageId}
                onUploaded={(url) => setCandidateModal({ ...candidateModal, photoUrl: url })}
              />
            </div>
            <div className="mb-4">
              <label className={FIELD_LABEL} htmlFor="cm-name">
                Name
              </label>
              <input
                className={TEXT_INPUT}
                id="cm-name"
                type="text"
                value={candidateModal.name}
                onChange={(e) => setCandidateModal({ ...candidateModal, name: e.target.value })}
              />
            </div>
            <div className="mb-7">
              <label className={FIELD_LABEL} htmlFor="cm-bio">
                Platform statement
              </label>
              <textarea
                className={TEXT_INPUT}
                id="cm-bio"
                rows={3}
                value={candidateModal.bio}
                onChange={(e) => setCandidateModal({ ...candidateModal, bio: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={SECONDARY_BTN} onClick={() => setCandidateModal(null)}>
                Cancel
              </button>
              <button type="button" className={PRIMARY_BTN} onClick={saveCandidateModal} disabled={candidateSaving}>
                {candidateSaving ? 'Saving…' : 'Save candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsModal && (
        <div className={MODAL_OVERLAY}>
          <div role="dialog" aria-label="Election settings" className={cn(MODAL_PANEL, MODAL_PANEL_WIDE)}>
            <h2 className="text-xl mb-6">Election settings</h2>
            {settingsError && (
              <p role="alert" className="text-seal-dark text-sm mb-4">
                {settingsError}
              </p>
            )}
            <div className="mb-5">
              <label className={FIELD_LABEL} htmlFor="sm-org">
                Organization name
              </label>
              <input
                className={TEXT_INPUT}
                id="sm-org"
                type="text"
                value={settingsModal.orgName}
                onChange={(e) => setSettingsModal({ ...settingsModal, orgName: e.target.value })}
              />
            </div>
            <div className="mb-5">
              <label className={FIELD_LABEL} htmlFor="sm-title">
                Election title
              </label>
              <input
                className={TEXT_INPUT}
                id="sm-title"
                type="text"
                value={settingsModal.title}
                onChange={(e) => setSettingsModal({ ...settingsModal, title: e.target.value })}
              />
            </div>
            <div className="flex gap-4 flex-wrap mb-6">
              <div className="flex-[1_1_200px]">
                <label className={FIELD_LABEL} htmlFor="sm-opens">
                  Opens
                </label>
                <input
                  className={TEXT_INPUT}
                  id="sm-opens"
                  type="datetime-local"
                  value={settingsModal.opens}
                  onChange={(e) => setSettingsModal({ ...settingsModal, opens: e.target.value })}
                />
              </div>
              <div className="flex-[1_1_200px]">
                <label className={FIELD_LABEL} htmlFor="sm-closes">
                  Closes
                </label>
                <input
                  className={TEXT_INPUT}
                  id="sm-closes"
                  type="datetime-local"
                  value={settingsModal.closes}
                  onChange={(e) => setSettingsModal({ ...settingsModal, closes: e.target.value })}
                />
              </div>
            </div>

            <fieldset className="mb-3">
              <legend>Who can vote</legend>
              <label className={RADIO_OPTION}>
                <input
                  type="radio"
                  name="sm-visibility"
                  className={RADIO_CHOICE_CLASS}
                  checked={!settingsModal.isPrivate}
                  onChange={() => setSettingsModal({ ...settingsModal, isPrivate: false })}
                />
                <span>Anyone with a Google or Microsoft account</span>
              </label>
              <label className={RADIO_OPTION}>
                <input
                  type="radio"
                  name="sm-visibility"
                  className={RADIO_CHOICE_CLASS}
                  checked={settingsModal.isPrivate}
                  onChange={() => setSettingsModal({ ...settingsModal, isPrivate: true })}
                />
                <span>Only people with a specific email domain</span>
              </label>
            </fieldset>

            {settingsModal.isPrivate && (
              <div className="mb-7 pl-7">
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  {settingsModal.domains.map((domain) => (
                    <span className={CHIP} key={domain}>
                      {domain}
                      <button type="button" className={CHIP_REMOVE_BTN} onClick={() => removeSettingsDomain(domain)} aria-label={`Remove ${domain}`}>
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
                    className="border border-ink bg-transparent rounded-[3px] px-[18px] py-0 text-sm cursor-pointer whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" className={SECONDARY_BTN} onClick={() => setSettingsModal(null)}>
                Cancel
              </button>
              <button type="button" className={PRIMARY_BTN} onClick={saveSettingsModal} disabled={settingsSaving}>
                {settingsSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
