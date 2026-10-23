import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { ESTAGIOS, SERVICOS } from '@/lib/comercial';
import { TAREFAS, TONS, gerarCopiloto, sortearVariacao, type Tarefa, type Tom } from '@/lib/copiloto';
import { entradaDoCopiloto, fichaDoLead } from '@/lib/copiloto-dados';
import { LIMITE_POR_DIA, pedidosHoje, registrarUso } from '@/lib/robo';
import { ErroIa, FALTA_CABECA, cabecaLigada } from '@/lib/cabeca';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

async function abrir(ctx: Ctx) {
  const s = await exigirSessao();
  if (s.erro) return { erro: s.erro } as const;
  if (!podeUsarConversa(s.sessao.email)) return { erro: NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 }) } as const;
  const { id } = await ctx.params;
  const lead = await buscarLead(s.sessao.contaId, decodeURIComponent(id).slice(0, 300));
  if (!lead) return { erro: NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 }) } as const;
  return { sessao: s.sessao, lead } as const;
}

/** a ficha comercial do lead (o que a IA sabe), para mostrar antes de gerar */
export async function GET(_req: Request, ctx: Ctx) {
  const a = await abrir(ctx);
  if ('erro' in a) return a.erro;
  const f = await fichaDoLead(a.sessao.contaId, a.lead);
  return NextResponse.json({
    ok: true,
    estagio: { id: f.ficha.estagio, ...ESTAGIOS[f.ficha.estagio] },
    fatos: f.ficha.fatos,
    oportunidades: f.ficha.oportunidades.map((o) => ({ ...o, nome: SERVICOS[o.servico].split(':')[0] })),
    naoSabemos: f.ficha.naoSabemos,
    followUp: f.ficha.followUp,
  });
}

/**
 * O copiloto comercial: { tarefa, tom?, pedido?, anteriores?, variacaoAnterior? }.
 * Só escreve: o texto vai para o editor e quem envia é você.
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const a = await abrir(ctx);
  if ('erro' in a) return a.erro;
  const { contaId, nome, artigo, userId } = a.sessao;
  if (!cabecaLigada()) return NextResponse.json({ ok: false, erro: FALTA_CABECA }, { status: 503 });
  if (await estourou('copiloto:' + userId, 20, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitos pedidos seguidos. Espere um minuto.' }, { status: 429 });
  }
  if ((await pedidosHoje(contaId)) >= LIMITE_POR_DIA) {
    return NextResponse.json({ ok: false, erro: 'A IA chegou ao limite de pedidos de hoje.' }, { status: 429 });
  }

  const corpo = (await req.json().catch(() => ({}))) as { tarefa?: unknown; tom?: unknown; pedido?: unknown; anteriores?: unknown; variacaoAnterior?: unknown };
  const tarefa: Tarefa = TAREFAS.includes(corpo.tarefa as Tarefa) ? (corpo.tarefa as Tarefa) : 'resposta';
  const tom: Tom = TONS.includes(corpo.tom as Tom) ? (corpo.tom as Tom) : 'padrao';
  const pedido = String(corpo.pedido ?? '').trim().slice(0, 500);
  const anteriores = (Array.isArray(corpo.anteriores) ? corpo.anteriores : []).map((x) => String(x).slice(0, 600)).slice(-6);
  // abordagem sem pedido: um jeito diferente de começar a cada clique
  const variacao = tarefa === 'abordagem' && !pedido ? sortearVariacao(typeof corpo.variacaoAnterior === 'string' ? corpo.variacaoAnterior : null) : null;

  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  try {
    const entrada = await entradaDoCopiloto(contaId, a.lead, { tarefa, tom, pedido, anteriores, variacao: variacao?.texto || null, nome, artigo, site });
    const r = await gerarCopiloto(entrada);
    if (r.uso) await registrarUso(contaId, a.lead.id, r.uso, `copiloto:${tarefa}`);
    return NextResponse.json({
      ok: true,
      tarefa,
      resposta: r.resposta,
      avisos: r.avisos,
      estagio: { id: entrada.ficha.estagio, rotulo: ESTAGIOS[entrada.ficha.estagio].rotulo },
      variacao: variacao ? { id: variacao.id, rotulo: variacao.rotulo } : null,
    });
  } catch (e) {
    const erro = e instanceof ErroIa ? e.message : 'A IA não respondeu agora. Tente de novo.';
    if (!(e instanceof ErroIa)) console.error('[copiloto]', e);
    return NextResponse.json({ ok: false, erro }, { status: 502 });
  }
}
