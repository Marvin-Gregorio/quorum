import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const CANDIDATE_PHOTOS_BUCKET = 'candidate-photos';
// Balances security (still time-limited) against breaking a long-open page
// — a manage console session left open longer than this will show broken
// images for previously-loaded photos until reloaded. Easy to change here
// if that trade-off turns out wrong in practice.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

// Signs with the caller's own session (not a service-role bypass), so RLS —
// specifically can_view_page_content() — is re-evaluated against whatever
// path is actually being signed, not just trusted because it's what a
// candidate row happens to store.
export async function signCandidatePhotoUrls(
  supabase: SupabaseClient<Database>,
  photoPaths: (string | null)[]
): Promise<Map<string, string>> {
  const paths = photoPaths.filter((p): p is string => p !== null);
  if (paths.length === 0) return new Map();

  const { data } = await supabase.storage.from(CANDIDATE_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS);
  const entries: [string, string][] = [];
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) entries.push([entry.path, entry.signedUrl]);
  }
  return new Map(entries);
}
