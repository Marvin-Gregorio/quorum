import Link from 'next/link';

export default function AccessRestrictedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '28px clamp(24px,5vw,64px)' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 22 }}>Quorum</div>
      </header>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>This election is only open to a specific email domain</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            Ask the organizer to add your email domain, or sign in with a different account.
          </p>
          <Link href="/sign-in">Sign in with a different account</Link>
          <br />
          <Link href="/">Return home</Link>
        </div>
      </div>
    </div>
  );
}
