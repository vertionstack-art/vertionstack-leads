import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { origemDoSite } from '@/lib/porta';
import { mensagensDaConversa, passosFeitos } from '@/lib/conversa';
import { dadosDoLead } from '@/lib/conversa-contexto';
import { sugerirMensagem, usoDaIa } from '@/lib/ia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** pede ao Claude a próxima mensagem desta conversa: { pedido? } */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!s.sessao.admin) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
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
  const d = await dadosDoLead(contaId, nome, lead, origemDoSite(req));
  const mensagens = (await mensagensDaConversa(contaId, idLead)).slice(-40);

  const r = await sugerirMensagem(contaId, idLead, {
    lead: {
      nome: lead.name,
      ramo: lead.category,
      cidade: lead.city,
      problema: d.problema,
      avaliacoes: d.avaliacoes,
      previa: d.previa,
      proposta: d.proposta,
      status: lead.status,
    },
    remetente: { nome, empresa: d.remetente.empresa, oferta: d.remetente.ofertaTexto || d.remetente.oferta || 'sites' },
    passosFeitos: await passosFeitos(contaId, idLead),
    mensagens: mensagens.map((m) => ({
      autor: m.autor,
      texto: m.texto,
      em: new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    })),
    pedido: String(corpo.pedido || '').trim().slice(0, 300),
  });

  const uso = await usoDaIa(contaId);
  if (!r.ok) return NextResponse.json({ ok: false, erro: r.erro, uso }, { status: r.status });
  return NextResponse.json({ ok: true, sugestao: r.sugestao, custoUsd: r.custoUsd, modelo: r.modelo, uso });
}
