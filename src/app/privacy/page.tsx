import { Header } from '@/components/header';

export const metadata = { title: `Privacy — ${process.env.NEXT_PUBLIC_NAME}` };

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <div className="grow px-[clamp(24px,5vw,64px)] pb-[clamp(48px,8vw,96px)] mt-10">
        <div className="max-w-[640px] mx-auto">
          <h1 className="text-[32px] mb-2">Privacy policy</h1>
          <p className="text-ink-2 text-sm mb-10">Last updated September 2026.</p>

          <div className="flex flex-col gap-8 text-[15px] leading-[1.7] text-ink-2">
            <section>
              <h2 className="text-ink text-lg mb-2">What this covers</h2>
              <p className="m-0">
                This policy applies to every election page created on {process.env.NEXT_PUBLIC_NAME} — both to the person who creates one
                and to anyone who signs in to vote on or view one.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Information we collect</h2>
              <p className="m-0 mb-3">When you sign in with Google or Microsoft, we receive your name and email
                address. When you vote, we record your choice and which positions you&apos;ve voted on. If you
                create an election, we store the settings you configure for it (title, voting window, allowed email
                domains, positions, and candidates).
              </p>
              <p className="m-0">
                Candidate photos are stored as uploaded image files. We don&apos;t collect payment information,
                government IDs, or any data beyond what&apos;s described here.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Your vote is secret</h2>
              <p className="m-0">
                Nobody — including the person who created the election — can see which candidate you chose. What a
                manager can see is turnout: whether you&apos;ve voted for a given position, and the aggregate vote
                count for each candidate. Your individual choice is never linked back to your identity for anyone
                but you.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">How this information is used</h2>
              <p className="m-0">
                Your name and email are used to sign you in, to enforce one vote per person per position, and — on
                private election pages — to check that your email domain is allowed to vote. An election&apos;s
                manager can see the settings and results for pages they created, and turnout for who has voted, but
                never individual ballot choices.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Who we share it with</h2>
              <p className="m-0">
                We don&apos;t sell your data or share it with advertisers. Data is processed by Google or Microsoft
                (for sign-in) and by Supabase (our database, authentication, and file storage provider), each under
                their own privacy terms.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Cookies</h2>
              <p className="m-0">
                We use only functional cookies: one to keep you signed in, and a short-lived one used solely to
                return you to the page you were on after signing in. We don&apos;t use tracking or advertising
                cookies.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">How long we keep data</h2>
              <p className="m-0">
                Election data is kept for as long as the election page exists. There is currently no self-service
                way to delete your account or vote history — see Contact below to request removal.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Changes to this policy</h2>
              <p className="m-0">
                This policy may be updated as {process.env.NEXT_PUBLIC_NAME} changes. Check back here if you have questions about how your
                information is handled.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Contact</h2>
              <p className="m-0">
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
