import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { esconderPassos } from '@/lib/passos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "não mostrar mais" no guia de primeiros passos */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('passos:' + s.sessao.contaId, 30, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas tentativas em pouco tempo. Espere um minuto.' }, { status: 429 });
  }
  await esconderPassos(s.sessao.contaId);
  return NextResponse.json({ ok: true });
}
