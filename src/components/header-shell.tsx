import type { ReactNode } from 'react';
import Link from 'next/link';

export function HeaderShell({ children, authSlot }: { children?: ReactNode; authSlot?: ReactNode }) {
  return (
    <header className="flex justify-between items-center px-[clamp(24px,5vw,64px)] py-6 border-b border-line flex-wrap gap-3">
      <Link href="/" className="font-['Fraunces',serif] italic font-semibold text-xl no-underline">
        Quorum
      </Link>
      <div className="flex items-center gap-5 flex-wrap">
        {children}
        {authSlot}
      </div>
    </header>
  );
}
