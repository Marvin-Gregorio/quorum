export function BallotIllustration() {
  return (
    <svg width="260" height="260" viewBox="0 0 280 280" role="img" aria-label="A folded ballot being placed into a ballot box">
      <rect x="40" y="120" width="200" height="130" rx="4" fill="var(--color-paper-2)" stroke="var(--color-ink)" strokeWidth="3" />
      <rect x="40" y="190" width="200" height="14" fill="var(--color-seal)" />
      <rect x="30" y="100" width="220" height="26" rx="3" fill="var(--color-ink)" />
      <rect x="120" y="106" width="40" height="8" rx="2" fill="var(--color-paper)" />
      <g transform="rotate(-8 150 70)">
        <rect x="110" y="20" width="80" height="100" rx="2" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <line x1="122" y1="38" x2="178" y2="38" stroke="var(--color-ink-2)" strokeWidth="2" />
        <line x1="122" y1="50" x2="178" y2="50" stroke="var(--color-ink-2)" strokeWidth="2" />
        <circle cx="128" cy="66" r="5" fill="none" stroke="var(--color-ink-2)" strokeWidth="2" />
        <line x1="140" y1="66" x2="178" y2="66" stroke="var(--color-line-strong)" strokeWidth="2" />
        <circle cx="128" cy="82" r="5" fill="var(--color-seal)" stroke="var(--color-seal)" strokeWidth="2" />
        <line x1="140" y1="82" x2="178" y2="82" stroke="var(--color-ink)" strokeWidth="2" />
      </g>
    </svg>
  );
}
