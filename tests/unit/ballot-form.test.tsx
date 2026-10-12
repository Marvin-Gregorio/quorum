import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BallotForm } from '@/app/vote/[ownerId]/[slug]/ballot-form';
import { FeedbackProvider } from '@/components/feedback-provider';
import type { Ballot } from '@/services/ballot';

const castVoteAction = vi.fn();
vi.mock('@/app/vote/[ownerId]/[slug]/actions', () => ({
  castVoteAction: (...args: unknown[]) => castVoteAction(...args),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
  castVoteAction.mockReset();
});

const ballot = {
  organizationName: 'Riverside Co-op',
  title: 'Board election',
  votingEndsAt: '2099-01-01T00:00:00.000Z',
  positions: [
    {
      id: 'p1',
      title: 'Chair',
      selectedCandidateId: 'c1',
      candidates: [{ id: 'c1', name: 'Ada', bio: '', photoUrl: null }],
    },
    {
      id: 'p2',
      title: 'Treasurer',
      selectedCandidateId: 'c2',
      candidates: [{ id: 'c2', name: 'Grace', bio: '', photoUrl: null }],
    },
  ],
} as unknown as Ballot;

function renderBallot() {
  render(
    <FeedbackProvider>
      <BallotForm ballot={ballot} />
    </FeedbackProvider>
  );
}

describe('BallotForm feedback', () => {
  it('shows a success toast after every position is saved', async () => {
    castVoteAction.mockResolvedValue({ ok: true });
    renderBallot();
    fireEvent.click(screen.getByRole('button', { name: 'Cast your vote' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your vote has been recorded'));
  });

  it('shows the error in a dialog when a vote is rejected', async () => {
    castVoteAction.mockResolvedValue({ error: 'Voting has closed.' });
    renderBallot();
    fireEvent.click(screen.getByRole('button', { name: 'Cast your vote' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Voting has closed.');
    expect(dialog).not.toHaveTextContent('earlier position');
  });

  it('says earlier positions were saved when a later one fails', async () => {
    castVoteAction.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ error: 'Voting has closed.' });
    renderBallot();
    fireEvent.click(screen.getByRole('button', { name: 'Cast your vote' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Your choices for 1 earlier position was saved');
  });

  it('shows a dialog when the action throws', async () => {
    castVoteAction.mockRejectedValue(new Error('network'));
    renderBallot();
    fireEvent.click(screen.getByRole('button', { name: 'Cast your vote' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Something went wrong');
  });
});
