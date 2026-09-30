'use client';

import { useEffect } from 'react';
import './globals.css';
import { PRIMARY_BTN } from '@/lib/ui-classes';
import { cn } from '@/lib/cn';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] text-center">
            <h1 className="text-2xl mb-3">Something went wrong.</h1>
            <p className="text-ink-2 text-[15px] leading-[1.6] m-0 mb-8">
              The application hit an unexpected error. Please try again.
            </p>
            <button onClick={() => reset()} className={cn(PRIMARY_BTN, 'px-7 py-[14px] text-[15px]')}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
