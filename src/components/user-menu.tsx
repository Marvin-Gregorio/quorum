'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/app/auth/actions';
import { initialsFor } from '@/lib/avatar';

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
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="user-avatar">{initialsFor(displayName)}</span>
        <span className="user-name-text">{displayName}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1L5 5L9 1" stroke="var(--ink-2)" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <Link href="/profile" role="menuitem">
            Profile
          </Link>
          <form action={signOutAction}>
            <button type="submit" role="menuitem" style={{ color: 'var(--seal-dark)' }}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
