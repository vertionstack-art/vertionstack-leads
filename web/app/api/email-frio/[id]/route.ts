import { NextResponse } from 'next/server';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { db } from '@/lib/sql';
import { cabecaLigada, ErroIa, FALTA_CABECA } from '@/lib/cabeca';
import { exigirEmailFrio } from '@/lib/email-frio-acesso';
import { gerarEmail, umEmail } from '@/lib/email-frio-fila';

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
  const atual = await umEmail(contaId, id);
  if (!atual) return NextResponse.json({ ok: false, erro: 'E-mail não encontrado.' }, { status: 404 });
  if (['enviando', 'enviado'].includes(atual.status)) return NextResponse.json({ ok: false, erro: 'Este e-mail já saiu.' }, { status: 409 });

  const c = (await req.json().catch(() => ({}))) as { acao?: string; assunto?: unknown; corpo?: unknown };
  const assunto = c.assunto === undefined ? null : String(c.assunto).replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const corpo = c.corpo === undefined ? null : String(c.corpo).replace(/\r/g, '').trim().slice(0, 4000);
  if (assunto !== null && assunto.length < 2) return NextResponse.json({ ok: false, erro: 'Escreva o assunto.' }, { status: 400 });
  if (corpo !== null && corpo.length < 40) return NextResponse.json({ ok: false, erro: 'O texto ficou curto demais.' }, { status: 400 });
  if (assunto !== null || corpo !== null) {
    await db()`update emails_frios set assunto = coalesce(${assunto}, assunto), corpo = coalesce(${corpo}, corpo) where conta_id = ${contaId} and id = ${id}`;
  }

  if (c.acao === 'aprovar') {
    await db()`update emails_frios set status = 'aprovado', aprovado_em = now(), erro = null where conta_id = ${contaId} and id = ${id} and status in ('rascunho', 'erro')`;
  } else if (c.acao === 'voltar') {
    await db()`update emails_frios set status = 'rascunho', aprovado_em = null where conta_id = ${contaId} and id = ${id} and status in ('aprovado', 'erro')`;
  } else if (c.acao === 'regerar') {
    if (!cabecaLigada()) return NextResponse.json({ ok: false, erro: FALTA_CABECA }, { status: 503 });
    try {
      return NextResponse.json({ ok: true, email: await gerarEmail(contaId, atual.leadId) });
    } catch (e) {
      const msg = e instanceof ErroIa ? 'A IA não respondeu agora. Tente de novo em um minuto.' : e instanceof Error ? e.message : 'Não consegui escrever outro.';
      return NextResponse.json({ ok: false, erro: msg }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true, email: await umEmail(contaId, id) });
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
