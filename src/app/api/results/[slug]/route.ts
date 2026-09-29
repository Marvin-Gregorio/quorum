import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkPageAccess } from '@/lib/access';
import { getResultsSnapshot } from '@/lib/queries/results';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: page } = await supabase
    .from('pages')
    .select('id, is_private, owner_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!page) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (page.is_private) {
    const { data: userData } = await supabase.auth.getUser();
    const access = await checkPageAccess(supabase, page, userData.user?.id ?? null, userData.user?.email ?? null);
    if (access !== 'ok') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const snapshot = await getResultsSnapshot(supabase, slug);
  return NextResponse.json(snapshot);
}
