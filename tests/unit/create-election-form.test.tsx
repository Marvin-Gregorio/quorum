import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateElectionForm } from '@/app/create/create-election-form';
import { FeedbackProvider } from '@/components/feedback-provider';

const createElectionAction = vi.fn();
vi.mock('@/app/create/actions', () => ({
  createElectionAction: (...args: unknown[]) => createElectionAction(...args),
}));
vi.mock('@/app/manage/[ownerId]/[slug]/actions', () => ({ updateCandidatePhotoAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createBrowserSupabaseClient: () => ({}) }));

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
  createElectionAction.mockReset();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValidBasics() {
  fill('Organization name', 'Riverside Co-op');
  fill('Election title', '  Board election  ');
  fill('Opens', '2099-01-01T09:00');
  fill('Closes', '2099-01-15T17:00');
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Create election' }));
}

function renderForm() {
  render(
    <FeedbackProvider>
      <CreateElectionForm />
    </FeedbackProvider>
  );
}

describe('CreateElectionForm validation', () => {
  it('blocks submit and names the missing field when the title is empty', async () => {
    renderForm();
    fill('Organization name', 'Riverside Co-op');
    fill('Opens', '2099-01-01T09:00');
    fill('Closes', '2099-01-15T17:00');
    submit();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Election title is required.');
    expect(createElectionAction).not.toHaveBeenCalled();
  });

  it('blocks submit when a date is cleared instead of throwing on toISOString', async () => {
    renderForm();
    fillValidBasics();
    fill('Opens', '');
    submit();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Please set an opening date');
    expect(createElectionAction).not.toHaveBeenCalled();
  });

  it('blocks submit when voting closes before it opens', async () => {
    renderForm();
    fillValidBasics();
    fill('Closes', '2098-12-31T09:00');
    submit();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Voting must close after it opens.');
    expect(createElectionAction).not.toHaveBeenCalled();
  });

  it('blocks submit when a position has no title', async () => {
    renderForm();
    fillValidBasics();
    fireEvent.click(screen.getByRole('button', { name: /add a position/i }));
    submit();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Position title is required.');
    expect(createElectionAction).not.toHaveBeenCalled();
  });

  it('rejects a malformed allowed domain instead of adding a chip', async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/specific email domain/i));
    fireEvent.change(screen.getByPlaceholderText(/add a domain/i), { target: { value: 'foo bar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Allowed domains must look like');
    expect(screen.queryByRole('button', { name: 'Remove foo bar' })).not.toBeInTheDocument();
  });

  it('sends the parsed (trimmed) payload to the action when everything is valid', async () => {
    createElectionAction.mockResolvedValue({ error: 'stop here' });
    renderForm();
    fillValidBasics();
    submit();
    await waitFor(() => expect(createElectionAction).toHaveBeenCalledTimes(1));
    expect(createElectionAction.mock.calls[0][0]).toMatchObject({
      organizationName: 'Riverside Co-op',
      title: 'Board election',
      isPrivate: false,
      domains: [],
      positions: [],
    });
  });
});
