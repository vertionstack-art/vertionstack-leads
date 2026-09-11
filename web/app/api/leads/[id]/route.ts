import { NextResponse } from 'next/server';
import { atualizarLead, apagarLead, type Status } from '@/lib/db';
import { estaLogado, usuarioAtual } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_VALIDOS: Status[] = ['novo', 'contatado', 'negociando', 'fechado', 'descartado'];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const quem = await usuarioAtual();
  if (!quem) {
    return NextResponse.json({ ok: false, erro: 'Nao autorizado.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as {
    status?: string;
    notes?: string | null;
    proposta?: unknown;
  };

  if (corpo.status && !STATUS_VALIDOS.includes(corpo.status as Status)) {
    return NextResponse.json({ ok: false, erro: 'Status invalido.' }, { status: 400 });
  }

  const lead = await atualizarLead(
    decodeURIComponent(id),
    {
      status: corpo.status as Status | undefined,
      notes: corpo.notes !== undefined ? (corpo.notes ? String(corpo.notes).slice(0, 2000) : null) : undefined,
      proposta: corpo.proposta,
    },
    quem,
  );

  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead nao encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await estaLogado())) {
    return NextResponse.json({ ok: false, erro: 'Nao autorizado.' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const ok = await apagarLead(decodeURIComponent(id));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
