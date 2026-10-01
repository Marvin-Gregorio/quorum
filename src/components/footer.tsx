import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-line py-8 px-[clamp(24px,5vw,64px)] flex justify-between items-center text-sm text-ink-2 flex-wrap gap-2">
      <div className="font-['Fraunces',serif] italic">{process.env.NEXT_PUBLIC_NAME}</div>
      <div className="flex items-center gap-5 flex-wrap">
        <span>Free for everyone with no uptime guarantee</span>
        <Link href="/privacy" className="text-ink-2">
          Privacy
        </Link>
        <Link href="/terms" className="text-ink-2">
          Terms
        </Link>
      </div>
    </footer>
  );
}
