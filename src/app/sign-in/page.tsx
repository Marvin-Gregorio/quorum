import Link from 'next/link';
import { Header } from '@/components/header';
import { SignInButtons } from './sign-in-buttons';

export default function SignInPage() {
  return (
    <>
      <Header showAuth={false} />
      <div className="grow flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[28px] mb-3">Sign in to {process.env.NEXT_PUBLIC_NAME}</h1>
          <p className="text-ink-2 text-[15px] leading-[1.6] m-0 mb-8">
            Sign in to vote, or to create and manage an election.
          </p>

          <SignInButtons />

          <p className="text-ink-2 text-[13px] leading-[1.6] mt-7 mb-0 mx-0">
            Your email address is only used to confirm you&apos;re eligible to vote — {process.env.NEXT_PUBLIC_NAME} never posts on your
            behalf. By continuing you agree to our{' '}
            <Link href="/terms" className="text-ink-2 underline underline-offset-[3px]">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-ink-2 underline underline-offset-[3px]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
