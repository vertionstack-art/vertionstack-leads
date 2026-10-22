import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { apagarMensagem, marcarPasso, mensagensDaConversa, passosFeitos, registrarMensagem } from '@/lib/conversa';
import { estadoDoRobo } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A conversa guiada de um lead. Por enquanto só a conta da Vertion usa
 * (podeUsarConversa): para as outras, 404, como se a rota não existisse.
 */
async function entrar(req: Request | null, ctx: Ctx) {
  if (req && !origemConfere(req)) return { erro: recusarOrigem() };
  const s = await exigirSessao();
  if (s.erro) return { erro: s.erro };
  if (!podeUsarConversa(s.sessao.email)) return { erro: NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 }) };
  if (req && (await estourou('conversa:' + s.sessao.userId, 120, 60))) {
    return { erro: NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 }) };
  }
  const { id } = await ctx.params;
  const lead = decodeURIComponent(id).slice(0, 300);
  if (!(await buscarLead(s.sessao.contaId, lead))) {
    return { erro: NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 }) };
  }
  return { conta: s.sessao.contaId, lead };
}

export async function GET(_req: Request, ctx: Ctx) {
  const e = await entrar(null, ctx);
  if (e.erro) return e.erro;
  const mensagens = await mensagensDaConversa(e.conta, e.lead);
  const passos = await passosFeitos(e.conta, e.lead);
  return NextResponse.json({ ok: true, mensagens, passos, robo: await estadoDoRobo(e.conta, e.lead) });
}

/**
 * { acao: 'mensagem', autor: 'eu' | 'cliente', texto, passo? }  registra uma fala
 * { acao: 'passo', passo, feito }                               marca ou desmarca um passo
 */
export async function POST(req: Request, ctx: Ctx) {
  const e = await entrar(req, ctx);
  if (e.erro) return e.erro;
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; autor?: string; texto?: string; passo?: string; feito?: boolean };

  if (corpo.acao === 'passo') {
    await marcarPasso(e.conta, e.lead, String(corpo.passo || '').slice(0, 40), corpo.feito !== false);
    return NextResponse.json({ ok: true, passos: await passosFeitos(e.conta, e.lead) });
  }

  if (corpo.acao === 'mensagem') {
    const autor = corpo.autor === 'cliente' ? 'cliente' : 'eu';
    const texto = String(corpo.texto || '').trim().slice(0, 2000);
    if (!texto) return NextResponse.json({ ok: false, erro: 'A mensagem está vazia.' }, { status: 400 });
    const m = await registrarMensagem(e.conta, e.lead, autor, texto, corpo.passo ? String(corpo.passo).slice(0, 40) : null);
    if (m === 'cheio') return NextResponse.json({ ok: false, erro: 'Esta conversa chegou ao limite de mensagens guardadas.' }, { status: 400 });
    return NextResponse.json({ ok: true, mensagem: m, passos: await passosFeitos(e.conta, e.lead) });
  }

  return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
}

/** apaga uma fala registrada errado: ?mensagem=123 */
export async function DELETE(req: Request, ctx: Ctx) {
  const e = await entrar(req, ctx);
  if (e.erro) return e.erro;
  const id = Number(new URL(req.url).searchParams.get('mensagem'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, erro: 'Mensagem inválida.' }, { status: 400 });
  const ok = await apagarMensagem(e.conta, e.lead, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
