import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { normalizarConfig } from '@/lib/robo-config';
import { salvarTreino, treinoDoRobo } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** o que o robô sabe e o jeito de escrever (tela "Treinar o robô") */
export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  const t = await treinoDoRobo(s.sessao.contaId);
  return NextResponse.json({ ok: true, config: t.cfg });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  if (await estourou('robo-treino:' + s.sessao.userId, 60, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas alterações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const corpo = await req.json().catch(() => null);
  const cfg = normalizarConfig(corpo?.config);
  await salvarTreino(s.sessao.contaId, cfg);
  return NextResponse.json({ ok: true, config: cfg });
}
