'use client';

import { useEffect } from 'react';
import type { ToastItem } from '@/types/feedback';

const TOAST_DURATION_MS = 5000;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="pointer-events-auto flex items-start gap-3 bg-paper text-ink border border-line border-l-4 border-l-ledger rounded-[3px] px-4 py-3 text-sm shadow-[0_4px_16px_rgba(28,43,58,0.18)]">
      <p className="m-0 grow">{toast.message}</p>
      <button
        type="button"
        className="bg-transparent border-none text-ink-2 cursor-pointer text-base leading-none p-0"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        &times;
      </button>
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
