import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao } from '@/lib/auth';
import { historicoDoLead } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { numeroWhatsapp } from '@/lib/telefone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** a ficha do lead: o lead, o histórico, o número do WhatsApp e quem manda a mensagem */
export async function GET(_req: Request, ctx: Ctx) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);

  const lead = await buscarLead(contaId, idLead);
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  const eventos = await historicoDoLead(contaId, idLead);
  const [c] = await db()`select empresa_nome from contas where id = ${contaId}`;

  // o mesmo critério do painel: número confirmado no link, ou o telefone se for celular
  const numero = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));

  return NextResponse.json({
    ok: true,
    lead,
    eventos,
    numero,
    remetente: { nome, empresa: (c?.empresa_nome as string) || null },
  });
}
