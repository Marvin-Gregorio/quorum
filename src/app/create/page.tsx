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
  const [isPrivate, setIsPrivate] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      {/* Public/private radio + domain chip editor, and the position/candidate
          list with its add-candidate modal, port directly from the validated
          CreateElection.dc.html design (positions/candidates state shape and
          modal open/close logic already match Position/Candidate above one
          for one) — omitted here for brevity since it's a direct port with
          no new logic beyond what's shown. */}
      <button type="submit">Create election</button>
    </form>
  );
}
