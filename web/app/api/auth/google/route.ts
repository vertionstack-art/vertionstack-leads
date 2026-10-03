import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { origemDoSite } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** começa o login com Google; a volta cai em /auth/confirmar */
export async function GET(req: Request) {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origemDoSite(req)}/auth/confirmar` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL('/login?erro=google', req.url));
  return NextResponse.redirect(data.url);
}
