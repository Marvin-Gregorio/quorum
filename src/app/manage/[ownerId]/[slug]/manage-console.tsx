'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { CandidateEditModal, type EditableCandidate } from './candidate-edit-modal';
import { ElectionSettingsModal, type ElectionSettings } from './election-settings-modal';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { toRoman } from '@/lib/roman';
import { useLiveVoteTallies, type Tally } from '@/lib/hooks/use-live-vote-tallies';
import { STATUS_BADGE_BASE, STATUS_BADGE_VARIANT, CANDIDATE_ROW, avatarClass, avatarImgClass } from '@/lib/ui-classes';

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
  const [settings, setSettings] = useState<ElectionSettings>({
    organizationName: initialOrgName,
    title: initialTitle,
    votingStartsAt: initialStartsAt,
    votingEndsAt: initialEndsAt,
    isPrivate: initialIsPrivate,
    domains: initialDomains,
  });
  const [positions, setPositions] = useState(initialPositions);

  const tallies = useLiveVoteTallies({ pageId, positionIds, initialTallies, enabled: true });
  const [turnout, setTurnout] = useState(initialTurnout);

  const [editingCandidate, setEditingCandidate] = useState<EditableCandidate | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    setEditingCandidate({ positionId, candidateId, name: cand.name, bio: cand.bio, photoUrl: cand.photoUrl });
  }

  function handleCandidateSaved(updated: EditableCandidate) {
    setPositions((prev) =>
      prev.map((pos) =>
        pos.id !== updated.positionId
          ? pos
          : {
              ...pos,
              candidates: pos.candidates.map((c) =>
                c.id === updated.candidateId ? { ...c, name: updated.name, bio: updated.bio, photoUrl: updated.photoUrl } : c
              ),
            }
      )
    );
    setEditingCandidate(null);
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

  const privacyLabel = settings.isPrivate ? `Private to ${settings.domains.join(', ') || 'no domains yet'}` : 'Public';
  const now = Date.now();
  const opensAtMs = new Date(settings.votingStartsAt).getTime();
  const closesAtMs = new Date(settings.votingEndsAt).getTime();
  const statusLine =
    now < opensAtMs
      ? `Opens ${formatDateTime(settings.votingStartsAt)}, closes ${formatDateTime(settings.votingEndsAt)}.`
      : now > closesAtMs
        ? `Closed. Voting ran from ${formatDateTime(settings.votingStartsAt)} through ${formatDateTime(settings.votingEndsAt)}.`
        : `Open now, from ${formatDateTime(settings.votingStartsAt)} through ${formatDateTime(settings.votingEndsAt)}.`;

  return (
    <div className="max-w-[900px] mx-auto w-full px-6 pt-6 pb-16 grow">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="text-sm text-ink-2 m-0 mb-1">{settings.organizationName}</p>
          <h1 className="text-[clamp(26px,4vw,32px)] m-0 mb-2">{settings.title}</h1>
          <p className="text-ink-2 text-sm m-0">{statusLine}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(STATUS_BADGE_BASE, STATUS_BADGE_VARIANT.neutral)}>{privacyLabel}</span>
          <button
            type="button"
            className="bg-transparent border border-ink rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink whitespace-nowrap"
            onClick={() => setSettingsOpen(true)}
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
                    <Image src={cand.photoUrl} alt="" width={48} height={48} className={avatarImgClass('md')} />
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

      {editingCandidate && (
        <CandidateEditModal
          pageId={pageId}
          initial={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onSaved={handleCandidateSaved}
        />
      )}

      {settingsOpen && (
        <ElectionSettingsModal
          pageId={pageId}
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            setSettings(updated);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
