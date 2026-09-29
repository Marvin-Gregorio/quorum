'use client';

import { useState } from 'react';
import { castVoteAction } from './actions';
import { initialsFor, colorForIndex } from '@/lib/avatar';
import { toRoman } from '@/lib/roman';
import type { Ballot } from '@/lib/queries/ballot';

export function BallotForm({ ballot }: { ballot: Ballot }) {
  const [selections, setSelections] = useState<Record<string, string | null>>(
    Object.fromEntries(ballot.positions.map((p) => [p.id, p.selectedCandidateId]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCast, setJustCast] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 24px 140px', flexGrow: 1 }}
    >
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 4px' }}>{ballot.organizationName}</p>
        <h1 style={{ fontSize: 'clamp(26px,4vw,34px)', margin: '0 0 12px' }}>{ballot.title}</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: 0 }}>
          Voting closes {new Date(ballot.votingEndsAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}.
          Choose one candidate per position.
        </p>
        {error && (
          <p role="alert" style={{ color: 'var(--seal-dark)', fontSize: 14, marginTop: 12 }}>
            {error}
          </p>
        )}
        {justCast && !error && (
          <p role="status" style={{ color: 'var(--ledger)', fontSize: 14, marginTop: 12 }}>
            Your vote has been recorded. You can change it anytime before voting closes.
          </p>
        )}
      </div>

      {ballot.positions.map((pos, pi) => (
        <fieldset key={pos.id} style={{ marginBottom: 48 }}>
          <legend>
            <span style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 20, color: 'var(--ink-2)' }}>
              {toRoman(pi + 1)}.
            </span>{' '}
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>{pos.title}</span>
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
                <div>
                  <div className="cand-name" style={{ fontWeight: 600, fontSize: 16 }}>
                    {cand.name}
                  </div>
                  <div style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{cand.bio}</div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--paper)',
          borderTop: '1px solid var(--line)',
          padding: '20px 4px',
          margin: '0 -4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', maxWidth: '46ch' }}>
          You can change your vote anytime before voting closes.
        </p>
        <button type="submit" className="primary-btn" style={{ padding: '14px 32px', fontSize: 16 }} disabled={submitting}>
          {submitting ? 'Casting…' : 'Cast your vote'}
        </button>
      </div>
    </form>
  );
}
