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

const PALETTE_CLASSES = ['bg-ink-2', 'bg-seal', 'bg-ledger'];

export function colorClassForIndex(index: number): string {
  return PALETTE_CLASSES[index % PALETTE_CLASSES.length];
}
