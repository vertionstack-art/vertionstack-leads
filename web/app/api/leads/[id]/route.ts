import { NextResponse } from 'next/server';
import { atualizarLead, apagarLead, buscarLead, type Status } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { emailValido } from '@/lib/email-lead';

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
  if (await estourou('lead:' + s.sessao.userId, 900, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome: quem } = s.sessao;

  const { id } = await ctx.params;
  const corpo = (await req.json().catch(() => ({}))) as {
    status?: string;
    notes?: string | null;
    proposta?: unknown;
    previaUrl?: string | null;
    cnpj?: unknown;
    briefing?: unknown;
    email?: string | null;
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

  const idLead = decodeURIComponent(id).slice(0, 300);

  let email: string | null | undefined = undefined;
  if (corpo.email !== undefined) {
    email = corpo.email ? emailValido(corpo.email) : null;
    if (corpo.email && !email) return NextResponse.json({ ok: false, erro: 'Esse e-mail não parece certo.' }, { status: 400 });
  }

  /*
   * A data do fechamento é carimbada aqui, no servidor, na primeira vez que a
   * proposta é marcada como fechada — é ela que põe o cliente no mês certo do
   * Financeiro. Fechar também leva o lead para o status "fechado".
   */
  let status = corpo.status as Status | undefined;
  let proposta = corpo.proposta;
  if (proposta && typeof proposta === 'object') {
    const nova = { ...(proposta as Record<string, unknown>) };
    const atual = await buscarLead(contaId, idLead);
    const antes = (atual?.proposta || {}) as Record<string, unknown>;
    if (nova.fechado) {
      nova.fechadoEm = typeof antes.fechadoEm === 'string' && antes.fechado ? antes.fechadoEm : new Date().toISOString();
      if (!status && atual?.status !== 'fechado') status = 'fechado';
    } else {
      delete nova.fechadoEm;
    }
    proposta = nova;
  }

  const lead = await atualizarLead(
    contaId,
    idLead,
    {
      status,
      notes: corpo.notes !== undefined ? (corpo.notes ? String(corpo.notes).slice(0, 2000) : null) : undefined,
      proposta,
      previaUrl,
      cnpj: corpo.cnpj,
      briefing: corpo.briefing,
      email,
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
  if (await estourou('lead:' + s.sessao.userId, 900, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const ok = await apagarLead(s.sessao.contaId, decodeURIComponent(id).slice(0, 300));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
