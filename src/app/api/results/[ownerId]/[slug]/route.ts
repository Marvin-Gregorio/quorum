import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/services/results';
import { resultsPollRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request, { params }: { params: Promise<{ ownerId: string; slug: string }> }) {
  // Public and unauthenticated-reachable, so there's no user to key on —
  // rate limit by IP instead. A backstop, not the primary defense: the
  // cache headers below already absorb most repeated polling on their own.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const { success } = await resultsPollRateLimit.limit(ip);
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { ownerId, slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (page.is_private) {
    const { data: userData } = await supabase.auth.getUser();
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access !== 'ok') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const snapshot = await getResultsSnapshot(supabase, ownerId, slug);
    // Never cached anywhere: this response was computed under one viewer's
    // access check, so caching it at a shared layer (e.g. Vercel's edge)
    // could serve it straight to a different, unauthorized viewer.
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const snapshot = await getResultsSnapshot(supabase, ownerId, slug);
  // Public results are the same for every viewer, so safe to cache at the
  // edge — matches the ~5-8s poll interval every viewer already uses
  // (live-results.tsx), turning N simultaneous polls into ~1 origin hit.
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
  });
}
