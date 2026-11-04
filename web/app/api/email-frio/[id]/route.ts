import { NextResponse } from 'next/server';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { db } from '@/lib/sql';
import { cabecaLigada, ErroIa, FALTA_CABECA } from '@/lib/cabeca';
import { exigirEmailFrio } from '@/lib/email-frio-acesso';
import { mexerNoEmail, type MudancaEmail } from '@/lib/email-frio-fila';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

/**
 * Mexer num e-mail antes de ele sair: salvar o texto editado, aprovar
 * (entra na fila de envio), voltar para rascunho ou pedir outro texto.
 * Depois de enviado, nada mais muda.
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirEmailFrio();
  if (s.erro) return s.erro;
  const { contaId } = s.sessao;
  const { id } = await ctx.params;
  if (!uuid(id)) return NextResponse.json({ ok: false, erro: 'E-mail não encontrado.' }, { status: 404 });
  const c = (await req.json().catch(() => ({}))) as MudancaEmail;
  if (c.acao === 'regerar' && !cabecaLigada()) return NextResponse.json({ ok: false, erro: FALTA_CABECA }, { status: 503 });
  try {
    const r = await mexerNoEmail(contaId, id, c);
    return NextResponse.json(r, { status: r.ok ? 200 : r.status });
  } catch (e) {
    const msg = e instanceof ErroIa ? 'A IA não respondeu agora. Tente de novo em um minuto.' : e instanceof Error ? e.message : 'Não consegui escrever outro.';
    return NextResponse.json({ ok: false, erro: msg }, { status: 400 });
  }
}

/** tira da fila (o lead volta para a lista de quem pode receber) */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirEmailFrio();
  if (s.erro) return s.erro;
  const { id } = await ctx.params;
  if (!uuid(id)) return NextResponse.json({ ok: false, erro: 'E-mail não encontrado.' }, { status: 404 });
  const r = await db()`delete from emails_frios where conta_id = ${s.sessao.contaId} and id = ${id} and status not in ('enviando', 'enviado') returning id`;
  return NextResponse.json(r.length ? { ok: true } : { ok: false, erro: 'Este e-mail já saiu ou não existe.' }, { status: r.length ? 200 : 409 });
}
