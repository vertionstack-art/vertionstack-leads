import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { avisosAbertos, ligarRoboNaConta, roboAtivoNaConta } from '@/lib/robo';
import { atendeNovos, ligarAtendeNovos } from '@/lib/entrada';

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
    atendeNovos: await atendeNovos(s.sessao.contaId),
    avisos: await avisosAbertos(s.sessao.contaId),
  });
}

/** o interruptor geral { ativo } ou o de quem chama primeiro { atendeNovos } */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  const corpo = (await req.json().catch(() => ({}))) as { ativo?: boolean; atendeNovos?: boolean };
  if (typeof corpo.atendeNovos === 'boolean') {
    await ligarAtendeNovos(s.sessao.contaId, corpo.atendeNovos);
    return NextResponse.json({ ok: true, atendeNovos: corpo.atendeNovos });
  }
  await ligarRoboNaConta(s.sessao.contaId, corpo.ativo === true);
  return NextResponse.json({ ok: true, ativo: corpo.ativo === true });
}
