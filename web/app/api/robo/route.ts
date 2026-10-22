import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { avisosAbertos, ligarRoboNaConta, roboAtivoNaConta } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** os avisos abertos do robô e se ele está ligado na conta (a lista de conversas confere de tempos em tempos) */
export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({
    ok: true,
    ativo: await roboAtivoNaConta(s.sessao.contaId),
    avisos: await avisosAbertos(s.sessao.contaId),
  });
}

/** o interruptor geral: { ativo } */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  const corpo = (await req.json().catch(() => ({}))) as { ativo?: boolean };
  await ligarRoboNaConta(s.sessao.contaId, corpo.ativo === true);
  return NextResponse.json({ ok: true, ativo: corpo.ativo === true });
}
