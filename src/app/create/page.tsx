'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createElectionAction, type CreateElectionInput } from './actions';

type Candidate = { id: string; name: string; bio: string };
type Position = { id: string; title: string; candidates: Candidate[] };

export default function CreateElectionPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [title, setTitle] = useState('');
  const [votingStartsAt, setVotingStartsAt] = useState('');
  const [votingEndsAt, setVotingEndsAt] = useState('');
  // Spec §2: elections are public by default. A full privacy toggle UI is
  // separately tracked (out of scope here) — this just fixes the default so
  // elections created through this shell are actually reachable by voters.
  const [isPrivate, setIsPrivate] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!votingStartsAt || !votingEndsAt) {
      setError('Please set both an opening and closing date/time for voting.');
      return;
    }
    const input: CreateElectionInput = {
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
    };
    const result = await createElectionAction(input);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.push(`/manage/${result.slug}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create an election</h1>
      {error && <p role="alert">{error}</p>}
      <label htmlFor="org-name">Organization name</label>
      <input id="org-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
      <label htmlFor="title">Election title</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="opens">Opens</label>
      <input id="opens" type="datetime-local" value={votingStartsAt} onChange={(e) => setVotingStartsAt(e.target.value)} />
      <label htmlFor="closes">Closes</label>
      <input id="closes" type="datetime-local" value={votingEndsAt} onChange={(e) => setVotingEndsAt(e.target.value)} />
      {/* TODO: the public/private radio + domain chip editor, and the
          position/candidate list with its add-candidate modal, are not
          built yet. This shell only submits organizationName/title/dates
          with an empty positions array and the isPrivate default above —
          intended state shape (Position/Candidate types) is sketched at the
          top of this file, but no UI reads or writes it yet. */}
      <button type="submit">Create election</button>
    </form>
  );
}
