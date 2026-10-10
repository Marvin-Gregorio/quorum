import Link from 'next/link';
import { Header } from '@/components/header';

// Header reads the session, which keeps this page dynamically rendered.
// A prerendered 404 can't carry the per-request CSP nonce, so its inline
// scripts would be blocked in production.
export default function NotFound() {
  return (
    <>
      <Header />
      <div className="grow flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] text-center">
          <h1 className="text-2xl mb-3">Page not found.</h1>
          <p className="text-ink-2 text-[15px] leading-[1.6] m-0 mb-8">That page doesn&apos;t exist, or the link is out of date.</p>
          <Link href="/" className="text-sm underline underline-offset-[3px]">
            Return home
          </Link>
        </div>
      </div>
    </>
  );
}
