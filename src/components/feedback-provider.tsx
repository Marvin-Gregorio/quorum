'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ErrorDialog } from '@/components/error-dialog';
import { ToastViewport } from '@/components/toast-viewport';
import type { FeedbackError, ToastItem } from '@/types/feedback';

type Feedback = {
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string) => void;
};

const DEFAULT_ERROR_TITLE = 'Something went wrong';

const FeedbackContext = createContext<Feedback | null>(null);

// Mounted in the root layout rather than per page so a toast raised just
// before a router.push (e.g. after creating an election) outlives the page
// that triggered it.
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<FeedbackError | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextToastId = useRef(0);

  const showError = useCallback((message: string, title = DEFAULT_ERROR_TITLE) => {
    setError({ title, message });
  }, []);

  const showSuccess = useCallback((message: string) => {
    const id = nextToastId.current++;
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const feedback = useMemo(() => ({ showError, showSuccess }), [showError, showSuccess]);

  return (
    <FeedbackContext.Provider value={feedback}>
      {children}
      <ErrorDialog error={error} onClose={clearError} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used within a FeedbackProvider');
  return feedback;
}
