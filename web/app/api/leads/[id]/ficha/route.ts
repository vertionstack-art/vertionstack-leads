import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao } from '@/lib/auth';
import { historicoDoLead } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { numeroWhatsapp } from '@/lib/telefone';
import { listarModelos } from '@/lib/modelos';
import { podeUsarConversa } from '@/lib/conversa-contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** a ficha do lead: o lead, o histórico, o número do WhatsApp e quem manda a mensagem */
export async function GET(_req: Request, ctx: Ctx) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome, email, artigo } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);

  const lead = await buscarLead(contaId, idLead);
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  const eventos = await historicoDoLead(contaId, idLead);
  const [c] = await db()`select empresa_nome, oferta, oferta_texto from contas where id = ${contaId}`;
  const modelos = await listarModelos(contaId);

  // o mesmo critério do painel: número confirmado no link, ou o telefone se for celular
  const numero = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));

  return NextResponse.json({
    ok: true,
    lead,
    eventos,
    numero,
    modelos,
    // a conversa guiada (app/conversa) por enquanto é só da conta da Vertion
    conversaGuiada: podeUsarConversa(email),
    remetente: {
      nome,
      artigo,
      empresa: (c?.empresa_nome as string) || null,
      oferta: (c?.oferta as string) || 'sites',
      ofertaTexto: (c?.oferta_texto as string) || null,
    },
  });
}
