import { describe, it, expect } from 'vitest';
import { sanitizeText } from '@/lib/sanitize';

describe('sanitizeText', () => {
  it('strips HTML tags from input', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('Hello');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeText('  Dana Okafor  ')).toBe('Dana Okafor');
  });

  it('leaves plain text untouched', () => {
    expect(sanitizeText('Wants a repair-request tracker everyone can see.')).toBe(
      'Wants a repair-request tracker everyone can see.'
    );
  });
});
