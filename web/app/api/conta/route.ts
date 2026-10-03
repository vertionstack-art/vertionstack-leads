import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { chaveAtiva, cotaDaConta, cotaParaJson, gerarChave, revogarChaves, soltarAparelho, type Plano } from '@/lib/conta';
import { LIMITES } from '@/lib/planos';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function info(userId: string, contaId: string, plano: Plano) {
  const [chave, cota] = await Promise.all([chaveAtiva(userId), cotaDaConta(contaId, plano)]);
  return { chave, cota: cotaParaJson(cota), maxAparelhos: LIMITES[plano].aparelhos };
}

export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { userId, contaId, plano, pagoAte, email, nome } = s.sessao;
  return NextResponse.json({ ok: true, email, nome, plano, pagoAte, ...(await info(userId, contaId, plano)) });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { userId, contaId, plano } = s.sessao;

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; aparelho?: string };

  if (corpo.acao === 'gerar') {
    if (await estourou('chave:' + userId, 10, 60 * 60)) {
      return NextResponse.json({ ok: false, erro: 'Chaves demais geradas na última hora. Espere um pouco.' }, { status: 429 });
    }
    const { chave } = await gerarChave(contaId, userId);
    // a chave inteira só sai nesta resposta; depois disso o servidor só guarda o hash
    return NextResponse.json({ ok: true, chaveNova: chave, ...(await info(userId, contaId, plano)) });
  }
  if (corpo.acao === 'revogar') {
    await revogarChaves(userId);
    return NextResponse.json({ ok: true, ...(await info(userId, contaId, plano)) });
  }
  if (corpo.acao === 'soltar' && corpo.aparelho) {
    await soltarAparelho(userId, String(corpo.aparelho).slice(0, 80));
    return NextResponse.json({ ok: true, ...(await info(userId, contaId, plano)) });
  }
  return NextResponse.json({ ok: false, erro: 'Pedido incompleto.' }, { status: 400 });
}
