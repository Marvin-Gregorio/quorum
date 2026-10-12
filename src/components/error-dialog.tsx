'use client';

import { useEffect, useId, useRef } from 'react';
import { PRIMARY_BTN } from '@/lib/ui-classes';
import type { FeedbackError } from '@/types/feedback';

export function ErrorDialog({ error, onClose }: { error: FeedbackError | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (error && !dialog.open) dialog.showModal();
    if (!error && dialog.open) dialog.close();
  }, [error]);

  // m-auto, border and text color are set explicitly: Tailwind's preflight
  // zeroes the dialog's UA margin (which is what centers it) and border.
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClose={onClose}
      className="m-auto w-full max-w-[440px] bg-paper text-ink border border-line rounded-[4px] p-8 backdrop:bg-[rgba(28,43,58,0.45)]"
    >
      {error && (
        <>
          <h2 id={titleId} className="text-xl mb-3 text-seal-dark">
            {error.title}
          </h2>
          <p id={messageId} className="text-[15px] mb-7">
            {error.message}
          </p>
          <div className="flex justify-end">
            <button type="button" className={PRIMARY_BTN} onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
