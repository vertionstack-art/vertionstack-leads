import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { origemDoSite } from '@/lib/porta';
import { contextoParaIa, podeUsarConversa } from '@/lib/conversa-contexto';
import { sugerirMensagem, usoDaIa } from '@/lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** pede ao Claude, pela API, a próxima mensagem desta conversa: { pedido? } */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  // além do limite em dólar: no máximo 10 pedidos por minuto, contra clique repetido
  if (await estourou('ia:' + s.sessao.userId, 10, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitos pedidos seguidos. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const lead = await buscarLead(contaId, idLead);
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });

  const corpo = (await req.json().catch(() => ({}))) as { pedido?: string };
  const c = await contextoParaIa(contaId, nome, lead, origemDoSite(req), String(corpo.pedido || ''));
  const r = await sugerirMensagem(contaId, idLead, c);

  const uso = await usoDaIa(contaId);
  if (!r.ok) return NextResponse.json({ ok: false, erro: r.erro, uso }, { status: r.status });
  return NextResponse.json({ ok: true, sugestao: r.sugestao, custoUsd: r.custoUsd, modelo: r.modelo, uso });
}
