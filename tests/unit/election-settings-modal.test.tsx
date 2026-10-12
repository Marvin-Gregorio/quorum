import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ElectionSettingsModal } from '@/app/manage/[ownerId]/[slug]/election-settings-modal';
import { FeedbackProvider } from '@/components/feedback-provider';

const updateElectionSettingsAction = vi.fn();
vi.mock('@/app/manage/[ownerId]/[slug]/actions', () => ({
  updateElectionSettingsAction: (...args: unknown[]) => updateElectionSettingsAction(...args),
}));

const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
  updateElectionSettingsAction.mockReset();
});

const initial = {
  organizationName: 'Riverside Co-op',
  title: 'Board election',
  votingStartsAt: '2099-01-01T09:00:00.000Z',
  votingEndsAt: '2099-01-15T17:00:00.000Z',
  isPrivate: false,
  domains: [] as string[],
};

function renderModal(onSaved = vi.fn()) {
  render(
    <FeedbackProvider>
      <ElectionSettingsModal pageId={PAGE_ID} initial={initial} onClose={vi.fn()} onSaved={onSaved} />
    </FeedbackProvider>
  );
  return onSaved;
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
}

describe('ElectionSettingsModal validation', () => {
  it('blocks save when the organization name is emptied', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Organization name'), { target: { value: '   ' } });
    save();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Organization name is required.');
    expect(updateElectionSettingsAction).not.toHaveBeenCalled();
  });

  it('blocks save when a date is cleared', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Closes'), { target: { value: '' } });
    save();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Please set a closing date');
    expect(updateElectionSettingsAction).not.toHaveBeenCalled();
  });

  it('blocks save when voting closes before it opens', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Closes'), { target: { value: '2000-01-01T00:00' } });
    save();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Voting must close after it opens.');
    expect(updateElectionSettingsAction).not.toHaveBeenCalled();
  });

  it('saves the parsed (trimmed) settings and reports them to the parent', async () => {
    updateElectionSettingsAction.mockResolvedValue({ ok: true });
    const onSaved = renderModal();
    fireEvent.change(screen.getByLabelText('Election title'), { target: { value: '  New title  ' } });
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateElectionSettingsAction).toHaveBeenCalledWith(PAGE_ID, expect.objectContaining({ title: 'New title' }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'New title' }));
  });
});
