import { NextResponse } from 'next/server';
import { atualizarLead, buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { registrarEvento } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A pessoa abriu o WhatsApp com a mensagem pronta. A ferramenta não manda
 * nada: só anota no histórico, carimba quando foi o contato e, se o lead
 * ainda era "novo", passa para "contatado" (o que também o põe no CRM).
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('lead:' + s.sessao.userId, 900, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome: quem } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const corpo = (await req.json().catch(() => ({}))) as { texto?: string };

  const atual = await buscarLead(contaId, idLead);
  if (!atual) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });

  const texto = String(corpo.texto || '').replace(/\s+/g, ' ').trim();
  await registrarEvento(contaId, idLead, 'whatsapp', texto ? `WhatsApp aberto: “${texto.slice(0, 160)}${texto.length > 160 ? '…' : ''}”` : 'WhatsApp aberto', quem);
  await db()`update leads set contatado_em = coalesce(contatado_em, now()) where conta_id = ${contaId} and id = ${idLead}`;

  const lead = atual.status === 'novo' ? await atualizarLead(contaId, idLead, { status: 'contatado' }, quem) : await buscarLead(contaId, idLead);
  return NextResponse.json({ ok: true, lead });
}
