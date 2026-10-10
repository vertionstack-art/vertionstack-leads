import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { lembretesParaHoje } from '@/lib/eventos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** o "para hoje": lembretes que vencem hoje ou já passaram */
export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  return NextResponse.json({ ok: true, lembretes: await lembretesParaHoje(s.sessao.contaId) });
}
