import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { definirLembrete } from '@/lib/eventos';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** marca ("ligar dia 12 às 10h") ou conclui (em: null) o lembrete do lead */
export async function PUT(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('lead:' + s.sessao.userId, 900, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome: quem } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const corpo = (await req.json().catch(() => ({}))) as { em?: string | null; texto?: string | null };

  let em: Date | null = null;
  if (corpo.em) {
    em = new Date(corpo.em);
    const agora = Date.now();
    if (Number.isNaN(em.getTime()) || em.getTime() < agora - 366 * 864e5 || em.getTime() > agora + 3 * 366 * 864e5) {
      return NextResponse.json({ ok: false, erro: 'Data do lembrete inválida.' }, { status: 400 });
    }
  }
  const texto = corpo.texto ? String(corpo.texto).trim().slice(0, 200) : null;
  const ok = await definirLembrete(contaId, idLead, em, texto, quem);
  if (!ok) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, lead: await buscarLead(contaId, idLead) });
}
