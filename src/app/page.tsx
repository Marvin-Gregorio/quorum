import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px clamp(24px,5vw,64px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>Quorum</div>
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 15 }}>
          <a href="#how-it-works">How it works</a>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>
      <section style={{ flexGrow: 1, padding: 'clamp(40px,8vw,96px) clamp(24px,5vw,64px)', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 'clamp(36px,5vw,56px)', lineHeight: 1.05, maxWidth: '13ch', marginBottom: 24 }}>
          Run a vote your whole organization can trust.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '46ch', marginBottom: 32 }}>
          Set up positions and candidates, choose which email domains are allowed to vote, and watch results come in as ballots are cast.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/create">Create an election</Link>
          <Link href="/results/example">See a live example</Link>
        </div>
      </section>
    </div>
  );
}
