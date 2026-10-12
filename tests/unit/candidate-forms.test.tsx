import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CandidateEditModal } from '@/app/manage/[ownerId]/[slug]/candidate-edit-modal';
import { CandidatePhotoUpload } from '@/app/manage/[ownerId]/[slug]/candidate-photo-upload';
import { CandidateModal } from '@/app/create/candidate-modal';
import { FeedbackProvider } from '@/components/feedback-provider';

const updateCandidateAction = vi.fn();
const updateCandidatePhotoAction = vi.fn();
vi.mock('@/app/manage/[ownerId]/[slug]/actions', () => ({
  updateCandidateAction: (...args: unknown[]) => updateCandidateAction(...args),
  updateCandidatePhotoAction: (...args: unknown[]) => updateCandidatePhotoAction(...args),
}));

const upload = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ storage: { from: () => ({ upload }) } }),
}));
const compressCandidatePhoto = vi.fn();
vi.mock('@/lib/image-compression', () => ({
  compressCandidatePhoto: (...args: unknown[]) => compressCandidatePhoto(...args),
}));

const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const POSITION_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';

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
  vi.clearAllMocks();
});

describe('CandidateEditModal validation', () => {
  const initial = { positionId: POSITION_ID, candidateId: CANDIDATE_ID, name: 'Dana', bio: 'Bio', photoUrl: null };

  function renderModal(onSaved = vi.fn()) {
    render(
      <FeedbackProvider>
        <CandidateEditModal pageId={PAGE_ID} initial={initial} onClose={vi.fn()} onSaved={onSaved} />
      </FeedbackProvider>
    );
    return onSaved;
  }

  it('blocks save when the name is emptied', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Candidate name is required.');
    expect(updateCandidateAction).not.toHaveBeenCalled();
  });

  it('blocks save when the bio is over 500 characters', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Platform statement'), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Candidate bio must be 500 characters or fewer.');
    expect(updateCandidateAction).not.toHaveBeenCalled();
  });

  it('saves the trimmed values', async () => {
    updateCandidateAction.mockResolvedValue({ ok: true });
    const onSaved = renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Dana O.  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateCandidateAction).toHaveBeenCalledWith(CANDIDATE_ID, { name: 'Dana O.', bio: 'Bio' });
  });
});

describe('CandidateModal (create flow) validation', () => {
  const initial = { name: '', bio: '', photoFile: null, previewUrl: null };

  function renderModal(onSave = vi.fn()) {
    render(
      <FeedbackProvider>
        <CandidateModal
          isEditing={false}
          colorClass=""
          initial={initial}
          onSave={onSave}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />
      </FeedbackProvider>
    );
    return onSave;
  }

  it('does not add a candidate with an empty name', async () => {
    const onSave = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add candidate|save/i }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Candidate name is required.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects a picked file that is not an image', async () => {
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Candidate photo must be an image.');
  });
});

describe('CandidatePhotoUpload validation', () => {
  it('rejects a non-image file before compressing or uploading', async () => {
    render(
      <FeedbackProvider>
        <CandidatePhotoUpload candidateId={CANDIDATE_ID} pageId={PAGE_ID} onUploaded={vi.fn()} />
      </FeedbackProvider>
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Candidate photo must be an image.');
    expect(compressCandidatePhoto).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(updateCandidatePhotoAction).not.toHaveBeenCalled();
  });

  it('refuses to upload when the ids would not form a valid storage path', async () => {
    render(
      <FeedbackProvider>
        <CandidatePhotoUpload candidateId="not-a-uuid" pageId={PAGE_ID} onUploaded={vi.fn()} />
      </FeedbackProvider>
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Invalid photo path.');
    expect(upload).not.toHaveBeenCalled();
  });
});
