import { NextResponse } from 'next/server';
import { atualizarLead, buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { caminhoDaPrevia } from '@/lib/token-proposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Prévia em 1 clique: grava no lead o link da prévia automática (app/s/...)
 * e devolve o endereço. Se o lead já tem uma prévia feita à mão (o DESIGN),
 * ela continua valendo e é a que volta.
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('previa:' + s.sessao.contaId, 60, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas tentativas em pouco tempo. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const lead = await buscarLead(contaId, idLead);
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  if (lead.previaUrl) return NextResponse.json({ ok: true, url: lead.previaUrl, nova: false });

  const url = new URL(caminhoDaPrevia(contaId, idLead), new URL(req.url).origin).toString();
  await atualizarLead(contaId, idLead, { previaUrl: url }, nome);
  return NextResponse.json({ ok: true, url, nova: true });
}
