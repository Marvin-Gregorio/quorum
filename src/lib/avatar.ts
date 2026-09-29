export function initialsFor(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const PALETTE = ['var(--ink-2)', 'var(--seal)', 'var(--ledger)'];

export function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length];
}
