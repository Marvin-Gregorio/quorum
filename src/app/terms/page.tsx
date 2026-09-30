import { Header } from '@/components/header';

export const metadata = { title: 'Terms — Quorum' };

export default function TermsPage() {
  return (
    <>
      <Header />

      <div className="grow px-[clamp(24px,5vw,64px)] pb-[clamp(48px,8vw,96px)]">
        <div className="max-w-[640px] mx-auto">
          <h1 className="text-[32px] mb-2">Terms of service</h1>
          <p className="text-ink-2 text-sm mb-10">Last updated September 2026.</p>

          <div className="flex flex-col gap-8 text-[15px] leading-[1.7] text-ink-2">
            <section>
              <h2 className="text-ink text-lg mb-2">Using Quorum</h2>
              <p className="m-0">
                By signing in or voting on a Quorum election, you agree to these terms. If you create an election
                page, you agree to them both as a user and as that page&apos;s manager.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">What Quorum is</h2>
              <p className="m-0">
                Quorum is a self-service tool: anyone signed in can create an election page and becomes its manager
                simply by creating it. We don&apos;t review or approve election pages before they go live.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">If you manage an election</h2>
              <p className="m-0 mb-3">
                You&apos;re responsible for the election page you create — its accuracy, the candidates and
                positions you add, and using it for lawful, legitimate purposes. Once voting opens, positions and
                candidates can no longer be added or removed, so votes already cast are never invalidated by a
                later change.
              </p>
              <p className="m-0">
                You can see turnout (who has voted) for your own election, but never how any individual voted —
                that choice is never exposed to you or anyone else.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Acceptable use</h2>
              <p className="m-0">
                Don&apos;t use Quorum to impersonate someone else, run an election for an unlawful or deceptive
                purpose, attempt to vote more than once per position, or try to bypass another page&apos;s access
                restrictions.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Availability</h2>
              <p className="m-0">
                Quorum is provided as-is, with no uptime guarantee. An election page may become temporarily
                unavailable, including due to hosting-provider limits outside our control.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Changes</h2>
              <p className="m-0">
                We may update these terms as Quorum changes, and may remove an election page that violates them.
              </p>
            </section>

            <section>
              <h2 className="text-ink text-lg mb-2">Contact</h2>
              <p className="m-0">
                This page doesn&apos;t yet list a contact address — add one here before relying on these terms for a
                live election.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
