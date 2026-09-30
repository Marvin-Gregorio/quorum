import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/services/results';

export async function GET(request: Request, { params }: { params: Promise<{ ownerId: string; slug: string }> }) {
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
  }

  const snapshot = await getResultsSnapshot(supabase, ownerId, slug);
  return NextResponse.json(snapshot);
}
