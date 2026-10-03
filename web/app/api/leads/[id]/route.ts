import { NextResponse } from 'next/server';
import { atualizarLead, apagarLead, type Status } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_VALIDOS: Status[] = ['novo', 'contatado', 'negociando', 'fechado', 'descartado'];

type Ctx = { params: Promise<{ id: string }> };

/** objeto grande demais não entra: o banco não é depósito de arquivo */
function jsonPequeno(v: unknown, maxBytes = 60_000): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'object' && JSON.stringify(v).length <= maxBytes;
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem } = s.sessao;

  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as {
    status?: string;
    notes?: string | null;
    proposta?: unknown;
    previaUrl?: string | null;
    cnpj?: unknown;
    briefing?: unknown;
  };

  if (corpo.status && !STATUS_VALIDOS.includes(corpo.status as Status)) {
    return NextResponse.json({ ok: false, erro: 'Status inválido.' }, { status: 400 });
  }
  if (!jsonPequeno(corpo.proposta) || !jsonPequeno(corpo.cnpj) || !jsonPequeno(corpo.briefing)) {
    return NextResponse.json({ ok: false, erro: 'Dados grandes demais.' }, { status: 413 });
  }

  // a prévia vira link clicável: só endereço http(s), nunca "javascript:"
  let previaUrl: string | null | undefined = undefined;
  if (corpo.previaUrl !== undefined) {
    const u = corpo.previaUrl ? String(corpo.previaUrl).trim().slice(0, 500) : '';
    if (u && !/^https?:\/\//i.test(u)) {
      return NextResponse.json({ ok: false, erro: 'O endereço da prévia precisa começar com https://' }, { status: 400 });
    }
    previaUrl = u || null;
  }

  const lead = await atualizarLead(
    contaId,
    decodeURIComponent(id).slice(0, 300),
    {
      status: corpo.status as Status | undefined,
      notes: corpo.notes !== undefined ? (corpo.notes ? String(corpo.notes).slice(0, 2000) : null) : undefined,
      proposta: corpo.proposta,
      previaUrl,
      cnpj: corpo.cnpj,
      briefing: corpo.briefing,
    },
    quem,
  );

  // lead de outra conta responde igual a lead inexistente
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { id } = await ctx.params;
  const ok = await apagarLead(s.sessao.contaId, decodeURIComponent(id).slice(0, 300));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
