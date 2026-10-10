import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { esconderPassos } from '@/lib/passos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "não mostrar mais" no guia de primeiros passos */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  await esconderPassos(s.sessao.contaId);
  return NextResponse.json({ ok: true });
}
