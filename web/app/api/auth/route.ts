import { NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/conta';
import { supabaseServidor } from '@/lib/supabase-server';
import { origemConfere, recusarOrigem } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await sessaoAtual();
  return NextResponse.json({ ok: true, usuario: s ? s.nome : null });
}

/** sair */
export async function DELETE(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
