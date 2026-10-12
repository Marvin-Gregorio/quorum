import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeedbackProvider, useFeedback } from '@/components/feedback-provider';

// jsdom doesn't implement HTMLDialogElement.showModal/close.
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
  vi.useRealTimers();
});

function Trigger() {
  const { showError, showSuccess } = useFeedback();
  return (
    <>
      <button onClick={() => showError('The window has closed.', 'Vote not recorded')}>error</button>
      <button onClick={() => showSuccess('Settings saved.')}>success</button>
    </>
  );
}

function renderWithProvider() {
  render(
    <FeedbackProvider>
      <Trigger />
    </FeedbackProvider>
  );
}

describe('FeedbackProvider', () => {
  it('shows an error dialog with the title and message', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('error'));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByText('Vote not recorded')).toBeInTheDocument();
    expect(screen.getByText('The window has closed.')).toBeInTheDocument();
  });

  it('closes the error dialog when Close is clicked', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('error'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('alertdialog', { hidden: true })).not.toHaveAttribute('open');
    expect(screen.queryByText('The window has closed.')).not.toBeInTheDocument();
  });

  it('shows a success toast that dismisses itself', () => {
    vi.useFakeTimers();
    renderWithProvider();
    fireEvent.click(screen.getByText('success'));
    expect(screen.getByRole('status')).toHaveTextContent('Settings saved.');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
  });

  it('dismisses a toast manually', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('success'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
  });

  it('throws when useFeedback is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/FeedbackProvider/);
    spy.mockRestore();
  });
});
