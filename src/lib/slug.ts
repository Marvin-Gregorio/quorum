import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function generateUniqueSlug(
  supabase: SupabaseClient<Database>,
  title: string
): Promise<string> {
  // A title with no ASCII alphanumeric characters (e.g. all emoji, all
  // punctuation) slugifies to an empty string, which would otherwise create
  // an unreachable election at a blank/collapsing slug. Fall back to a
  // short random suffix so the slug is never empty.
  const base = slugify(title) || `election-${crypto.randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 2;

  // This pre-check only sees rows visible to the caller under RLS, so it
  // can't detect a collision with another user's private page — the actual
  // insert is the source of truth and the caller should retry on a real
  // unique-constraint violation (Postgres error code 23505) rather than
  // trusting this check alone.
  while (true) {
    const { data } = await supabase.from('pages').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** Derives the next candidate slug to retry with after a unique-constraint
 * violation on `previousSlug` (itself derived from `baseSlug`). */
export function nextSlugAttempt(baseSlug: string, previousSlug: string): string {
  const match = previousSlug.match(new RegExp(`^${escapeRegExp(baseSlug)}-(\\d+)$`));
  const nextSuffix = match ? Number(match[1]) + 1 : 2;
  return `${baseSlug}-${nextSuffix}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
