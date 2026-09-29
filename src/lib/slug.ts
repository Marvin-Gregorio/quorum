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
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabase.from('pages').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
