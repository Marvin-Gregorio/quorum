'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/app/auth/actions';
import { initialsFor } from '@/lib/avatar';
import { cn } from '@/lib/cn';

const DROPDOWN_ITEM =
  'block w-full text-left px-4 py-[10px] text-sm bg-transparent border-none cursor-pointer no-underline ' +
  'border-b border-line last:border-b-0 hover:bg-paper-2';

export function UserMenu({ name, email }: { name: string | null; email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayName = name ?? email ?? '';

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2.5 bg-transparent border-none cursor-pointer p-1 rounded-[3px] hover:bg-paper-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-paper font-semibold text-xs shrink-0 bg-ink-2">
          {initialsFor(displayName)}
        </span>
        <span className="text-sm text-ink max-[480px]:hidden">{displayName}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="var(--color-ink-2)" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] bg-paper border border-line rounded-[3px] min-w-[170px] overflow-hidden z-30"
          role="menu"
        >
          <Link href="/profile" role="menuitem" className={cn(DROPDOWN_ITEM, 'text-ink')}>
            Profile
          </Link>
          <form action={signOutAction}>
            <button type="submit" role="menuitem" className={cn(DROPDOWN_ITEM, 'text-seal-dark')}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
