'use client';

import { useState } from 'react';
import { castVoteAction } from './actions';
import { initialsFor, colorClassForIndex } from '@/lib/avatar';
import { cn } from '@/lib/cn';
import { toRoman } from '@/lib/roman';
import type { Ballot } from '@/lib/queries/ballot';

export function BallotForm({ ballot }: { ballot: Ballot }) {
  const [selections, setSelections] = useState<Record<string, string | null>>(
    Object.fromEntries(ballot.positions.map((p) => [p.id, p.selectedCandidateId]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCast, setJustCast] = useState(false);

  const allSelected = ballot.positions.length > 0 && ballot.positions.every((p) => !!selections[p.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allSelected) return;
    setSubmitting(true);
    setError(null);
    setJustCast(false);
    try {
      const entries = Object.entries(selections).filter(([, candidateId]) => candidateId);
      for (const [positionId, candidateId] of entries) {
        const result = await castVoteAction(positionId, candidateId!);
        if ('error' in result) {
          setError(result.error);
          return;
        }
      }
      setJustCast(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-[720px] w-full mx-auto px-6 pt-6 pb-[140px] grow"
    >
      <div className="mb-9">
        <p className="text-sm text-ink-2 m-0 mb-1">{ballot.organizationName}</p>
        <h1 className="text-[clamp(26px,4vw,34px)] m-0 mb-3">{ballot.title}</h1>
        <p className="text-ink-2 text-[15px] m-0">
          Voting closes {new Date(ballot.votingEndsAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}.
          Choose one candidate per position.
        </p>
        {error && (
          <p role="alert" className="text-seal-dark text-sm mt-3">
            {error}
          </p>
        )}
        {justCast && !error && (
          <p role="status" className="text-ledger text-sm mt-3">
            Your vote has been recorded. You can change it anytime before voting closes.
          </p>
        )}
      </div>

      {ballot.positions.map((pos, pi) => (
        <fieldset key={pos.id} className="mb-12">
          <legend>
            <span className="font-['Fraunces',serif] italic text-xl text-ink-2">
              {toRoman(pi + 1)}.
            </span>{' '}
            <span className="font-['Fraunces',serif] text-2xl">{pos.title}</span>
          </legend>
          <div className="ballot-list">
            {pos.candidates.map((cand, ci) => (
              <label className="ballot-row" key={cand.id}>
                <input
                  type="radio"
                  name={`pos-${pos.id}`}
                  className="bubble"
                  checked={selections[pos.id] === cand.id}
                  onChange={() => setSelections((prev) => ({ ...prev, [pos.id]: cand.id }))}
                />
                <div
                  className={cn('avatar', !cand.photoUrl && colorClassForIndex(ci))}
                  style={cand.photoUrl ? { backgroundImage: `url(${cand.photoUrl})` } : undefined}
                >
                  {!cand.photoUrl && initialsFor(cand.name)}
                </div>
                <div>
                  <div className="cand-name font-semibold text-base">
                    {cand.name}
                  </div>
                  <div className="text-ink-2 text-sm leading-[1.5] mt-1">{cand.bio}</div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 left-0 right-0 bg-paper border-t border-line py-5 px-1 -mx-1 flex justify-between items-center gap-4 flex-wrap">
        <p className="m-0 text-sm text-ink-2 max-w-[46ch]">
          {allSelected
            ? 'You can change your vote anytime before voting closes.'
            : 'Choose a candidate for every position to cast your vote.'}
        </p>
        <button
          type="submit"
          className="primary-btn px-8 py-[14px] text-base"
          disabled={submitting || !allSelected}
        >
          {submitting ? 'Casting…' : 'Cast your vote'}
        </button>
      </div>
    </form>
  );
}
