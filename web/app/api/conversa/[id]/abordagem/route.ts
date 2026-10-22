import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { dadosDoLead, podeUsarConversa } from '@/lib/conversa-contexto';
import { eu } from '@/lib/mensagem';
import { rotuloDoInteresse } from '@/lib/interesses';
import { gerarAbordagem, mensagensSeguras, sortearAngulo, type DadosAbordagem } from '@/lib/robo-cerebro';
import { LIMITE_POR_DIA, pedidosHoje, registrarUso, treinoDoRobo } from '@/lib/robo';
import { ErroIa, FALTA_CABECA, cabecaLigada } from '@/lib/cabeca';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const QUEBRADOS = ['fora_do_ar', 'nao_encontrado', 'em_construcao', 'virou_social', 'certificado_vencido', 'sem_https'];

/**
 * "Gerar nova abordagem": uma primeira mensagem nova para este lead, escrita
 * pela IA no seu jeito (treino do robô), por um ângulo sorteado a cada
 * clique. Só preenche o editor: quem envia é você.
 * { anteriores: string[], anguloAnterior?: string }
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  if (!cabecaLigada()) return NextResponse.json({ ok: false, erro: FALTA_CABECA }, { status: 503 });
  if (await estourou('abordagem:' + s.sessao.userId, 20, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas abordagens seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome, artigo } = s.sessao;
  if ((await pedidosHoje(contaId)) >= LIMITE_POR_DIA) {
    return NextResponse.json({ ok: false, erro: 'A IA chegou ao limite de pedidos de hoje.' }, { status: 429 });
  }

  const { id } = await ctx.params;
  const lead = await buscarLead(contaId, decodeURIComponent(id).slice(0, 300));
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  const corpo = (await req.json().catch(() => ({}))) as { anteriores?: unknown; anguloAnterior?: unknown };
  const anteriores = (Array.isArray(corpo.anteriores) ? corpo.anteriores : []).map((x) => String(x).slice(0, 600)).slice(-6);

  const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  const d = await dadosDoLead(contaId, nome, lead, site, artigo);
  const t = await treinoDoRobo(contaId);
  const dados: DadosAbordagem = {
    nome: lead.name,
    tipo: lead.tipo,
    ramo: lead.category,
    cidade: lead.city,
    problema: d.problema,
    detalheSite: lead.siteDetalhe,
    avaliacoes: d.avaliacoes,
    instagram: Boolean(lead.instagram),
    previa: d.previa,
    interesse: lead.interesse.map(rotuloDoInteresse),
    ideia: lead.ideia,
    semSite: lead.websiteKind === 'none' || lead.websiteKind === 'social',
    siteComProblema: QUEBRADOS.includes(lead.siteStatus || ''),
  };
  const angulo = sortearAngulo(dados, typeof corpo.anguloAnterior === 'string' ? corpo.anguloAnterior : null);

  try {
    const r = await gerarAbordagem(t.cfg, t.empresa, t.oferta, eu(d.remetente), dados, angulo, anteriores);
    await registrarUso(contaId, lead.id, r);
    const segura = mensagensSeguras([r.mensagem], d.previa ? [d.previa] : []);
    if (!segura) return NextResponse.json({ ok: false, erro: 'A IA escreveu algo que não pode sair (link ou trecho inventado). Clique de novo.' }, { status: 422 });
    return NextResponse.json({ ok: true, mensagem: segura[0], angulo: angulo.id, rotulo: angulo.rotulo });
  } catch (e) {
    const erro = e instanceof ErroIa ? e.message : 'A IA não respondeu agora. Tente de novo.';
    return NextResponse.json({ ok: false, erro }, { status: 502 });
  }
}
