import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px clamp(24px,5vw,64px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>
          Quorum
        </div>
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 15 }}>
          <a href="#how-it-works" style={{ textDecoration: 'none' }}>
            How it works
          </a>
          <Link href="/sign-in" className="signin-btn">
            Sign in
          </Link>
        </nav>
      </header>

      <section
        style={{
          flexGrow: 1,
          display: 'flex',
          flexWrap: 'wrap-reverse',
          alignItems: 'center',
          gap: 48,
          padding: 'clamp(40px,8vw,96px) clamp(24px,5vw,64px)',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ flex: '1 1 420px', minWidth: 280 }}>
          <h1
            style={{
              fontSize: 'clamp(36px,5vw,56px)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              margin: '0 0 24px',
              maxWidth: '13ch',
            }}
          >
            Run a vote your whole organization can trust.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '46ch', margin: '0 0 32px' }}>
            Set up positions and candidates, choose which email domains are allowed to vote, and watch results come
            in as ballots are cast.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/create" className="primary-btn" style={{ padding: '14px 28px', fontSize: 16 }}>
              Create an election
            </Link>
          </div>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 260, display: 'flex', justifyContent: 'center' }}>
          <svg width="260" height="260" viewBox="0 0 280 280" role="img" aria-label="A folded ballot being placed into a ballot box">
            <rect x="40" y="120" width="200" height="130" rx="4" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="3" />
            <rect x="40" y="190" width="200" height="14" fill="var(--seal)" />
            <rect x="30" y="100" width="220" height="26" rx="3" fill="var(--ink)" />
            <rect x="120" y="106" width="40" height="8" rx="2" fill="var(--paper)" />
            <g transform="rotate(-8 150 70)">
              <rect x="110" y="20" width="80" height="100" rx="2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.5" />
              <line x1="122" y1="38" x2="178" y2="38" stroke="var(--ink-2)" strokeWidth="2" />
              <line x1="122" y1="50" x2="178" y2="50" stroke="var(--ink-2)" strokeWidth="2" />
              <circle cx="128" cy="66" r="5" fill="none" stroke="var(--ink-2)" strokeWidth="2" />
              <line x1="140" y1="66" x2="178" y2="66" stroke="var(--line-strong)" strokeWidth="2" />
              <circle cx="128" cy="82" r="5" fill="var(--seal)" stroke="var(--seal)" strokeWidth="2" />
              <line x1="140" y1="82" x2="178" y2="82" stroke="var(--ink)" strokeWidth="2" />
            </g>
          </svg>
        </div>
      </section>

      <section
        id="how-it-works"
        style={{
          borderTop: '1px solid var(--line)',
          padding: 'clamp(48px,6vw,80px) clamp(24px,5vw,64px)',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <h2 style={{ fontSize: 28, marginBottom: 40 }}>How it works</h2>
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, color: 'var(--seal)', marginBottom: 12 }}>
              1
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Set up the ballot</h3>
            <p style={{ color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Add each position and its candidates, and decide who&apos;s allowed to vote — anyone, or just people
              with a matching email domain.
            </p>
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, color: 'var(--seal)', marginBottom: 12 }}>
              2
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Share two links</h3>
            <p style={{ color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              One link for people to vote, one for anyone to watch results. Voters sign in with Google or Microsoft,
              so each person gets exactly one vote per position.
            </p>
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, color: 'var(--seal)', marginBottom: 12 }}>
              3
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Watch it come in</h3>
            <p style={{ color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Results update on their own as votes are cast. Nobody, including you, can see how any one person voted.
            </p>
          </div>
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '32px clamp(24px,5vw,64px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 14,
          color: 'var(--ink-2)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>Quorum</div>
        <div>Free for small and mid-sized organizations</div>
      </footer>
    </div>
  );
}
