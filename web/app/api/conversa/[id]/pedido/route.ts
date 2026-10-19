import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { origemDoSite } from '@/lib/porta';
import { contextoParaIa, podeUsarConversa } from '@/lib/conversa-contexto';
import { pedidoParaColar } from '@/lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * O pedido em texto para colar no chat do claude.ai, usando o plano da
 * pessoa: o mesmo roteiro, dados do lead e conversa que a API receberia.
 * Não chama o Claude nem gasta nada aqui. { pedido? }
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  if (await estourou('pedido-ia:' + s.sessao.userId, 30, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitos pedidos seguidos. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome } = s.sessao;
  const { id } = await ctx.params;
  const lead = await buscarLead(contaId, decodeURIComponent(id).slice(0, 300));
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });

  const corpo = (await req.json().catch(() => ({}))) as { pedido?: string };
  const c = await contextoParaIa(contaId, nome, lead, origemDoSite(req), String(corpo.pedido || ''));
  return NextResponse.json({ ok: true, texto: pedidoParaColar(c) });
}
