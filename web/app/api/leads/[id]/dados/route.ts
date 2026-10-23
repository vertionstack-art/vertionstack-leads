import { NextResponse } from 'next/server';
import { buscarLead, editarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { interessesValidos } from '@/lib/interesses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** os dados do lead para a tela "Editar lead" */
export async function GET(_req: Request, ctx: Ctx) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { id } = await ctx.params;
  const l = await buscarLead(s.sessao.contaId, decodeURIComponent(id).slice(0, 300));
  if (!l) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  return NextResponse.json({
    ok: true,
    dados: {
      name: l.name,
      category: l.category || '',
      phone: l.phone || '',
      whatsapp: l.whatsapp || '',
      email: l.email || '',
      city: l.city || '',
      address: l.address || '',
      website: l.website || '',
      instagram: l.instagram || '',
      mapsUrl: l.mapsUrl || '',
      tipo: l.tipo,
      interesse: l.interesse,
      ideia: l.ideia || '',
    },
  });
}

/** salva a edição (todos os campos de uma vez, como estão na tela) */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('editar-lead:' + s.sessao.userId, 60, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas edições seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = texto(c.name, 250);
  if (!name) return NextResponse.json({ ok: false, erro: 'O nome não pode ficar vazio.' }, { status: 400 });

  const lead = await editarLead(
    s.sessao.contaId,
    decodeURIComponent(id).slice(0, 300),
    {
      name,
      category: texto(c.category, 120),
      phone: texto(c.phone, 40),
      whatsapp: texto(c.whatsapp, 40),
      email: texto(c.email, 254),
      city: texto(c.city, 120),
      address: texto(c.address, 300),
      website: texto(c.website, 900),
      instagram: texto(c.instagram, 300),
      mapsUrl: texto(c.mapsUrl, 900),
      tipo: c.tipo === 'pessoa' ? 'pessoa' : 'comercio',
      interesse: interessesValidos(c.interesse),
      ideia: texto(c.ideia, 3000),
    },
    s.sessao.nome,
  );
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}
