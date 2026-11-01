import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { db } from '@/lib/sql';
import { avaliarSite, notaEmTexto, type AvaliacaoSite } from '@/lib/nota-site';
import { leituraDoLead } from '@/lib/leitura-site';
import { cabecaLigada, ErroIa, FALTA_CABECA, perguntarJson } from '@/lib/cabeca';
import { LIMITE_POR_DIA, pedidosHoje, registrarUso } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const DIAS_VALIDADE = 14;

const INSTRUCOES = `Você avalia o site de um pequeno comércio para um vendedor de sites. Escreva em português do Brasil, curto e direto.

Regras:
- Use SÓ os dados recebidos (nota medida, velocidade do teste do Google, o que foi achado ou não no HTML, título, descrição e assuntos da página). Não invente número, visitas, design ou qualquer coisa que não esteja nos dados.
- "Não achei no HTML" não prova que não existe (pode ser montado por JavaScript). Escreva "não achei" em vez de "não tem".
- Não fale de visitas ou tráfego: ninguém de fora sabe esse número.
- "resumo": 1 ou 2 frases dizendo se o site ajuda ou atrapalha o comércio a conseguir cliente, e por quê.
- "pontos": de 2 a 4 observações concretas que o vendedor pode usar na conversa, cada uma com no máximo 18 palavras, começando pelo que mais pesa.`;

const ESQUEMA = {
  type: 'object',
  properties: {
    resumo: { type: 'string' },
    pontos: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumo', 'pontos'],
};

/**
 * "Avaliar site com IA" na ficha: mede de novo se a nota estiver velha (ou
 * nunca foi medida) e pede à IA um resumo curto, só com o que foi medido.
 * Roda no seu clique, um lead por vez, porque a cota grátis da IA é dividida
 * com o robô.
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, userId } = s.sessao;
  if (await estourou('avaliar-site:' + userId, 12, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas avaliações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { id } = await ctx.params;
  const lead = await buscarLead(contaId, decodeURIComponent(id).slice(0, 300));
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });
  if (!lead.website || lead.websiteKind !== 'site') {
    return NextResponse.json({ ok: false, erro: 'Este lead não tem site próprio para avaliar.' }, { status: 400 });
  }

  // a nota medida: reaproveita se for recente, senão mede de novo
  let av: AvaliacaoSite | null = lead.siteAvaliacao;
  const velha = !av || Date.now() - new Date(av.medidoEm).getTime() > DIAS_VALIDADE * 86400_000;
  if (velha) av = await avaliarSite(lead.website, 25_000).catch(() => null);
  if (!av) return NextResponse.json({ ok: false, erro: 'Não consegui abrir o site para avaliar. Ele pode estar fora do ar ou bloqueando robôs.' }, { status: 502 });

  if (!cabecaLigada()) {
    await salvar(contaId, lead.id, av);
    return NextResponse.json({ ok: true, avaliacao: av, aviso: FALTA_CABECA });
  }
  if ((await pedidosHoje(contaId)) >= LIMITE_POR_DIA) {
    await salvar(contaId, lead.id, av);
    return NextResponse.json({ ok: true, avaliacao: av, aviso: 'A IA chegou ao limite de pedidos de hoje. A nota foi medida; o resumo fica para amanhã.' });
  }

  const leitura = await leituraDoLead(contaId, lead).catch(() => null);
  const dados = [
    `Comércio: ${lead.name}${lead.category ? ` (${lead.category})` : ''}${lead.city ? `, ${lead.city}` : ''}.`,
    `Site: ${av.url}`,
    `Nota medida pela ferramenta: ${notaEmTexto(av.nota)} de 10.`,
    av.velocidade !== null ? `Teste de velocidade do Google no celular: ${av.velocidade} de 100${av.carregaEmS ? `, conteúdo principal aparece em ${String(av.carregaEmS).replace('.', ',')} s` : ''}.` : 'Velocidade no celular: não deu para medir.',
    av.problemas.length ? `Problemas achados: ${av.problemas.map((p) => p.texto).join('; ')}.` : 'Nenhum problema achado pelas regras da ferramenta.',
    leitura?.lido ? `Título: ${leitura.titulo || '(sem título)'}. Descrição: ${leitura.descricao || '(sem descrição)'}. Assuntos da página: ${leitura.assuntos.join(' | ') || '(nenhum título h1/h2)'}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const r = await perguntarJson<{ resumo: string; pontos: string[] }>(INSTRUCOES, dados, ESQUEMA);
    await registrarUso(contaId, lead.id, { modelo: r.modelo, entrada: r.entrada, saida: r.saida }, 'avaliar-site').catch(() => {});
    const ia = {
      resumo: String(r.dados.resumo || '').slice(0, 400),
      pontos: (Array.isArray(r.dados.pontos) ? r.dados.pontos : []).map((p) => String(p).slice(0, 200)).slice(0, 4),
      em: new Date().toISOString(),
    };
    av = { ...av, ia };
    await salvar(contaId, lead.id, av);
    return NextResponse.json({ ok: true, avaliacao: av });
  } catch (e) {
    await salvar(contaId, lead.id, av);
    const erro = e instanceof ErroIa ? e.message : 'A IA não respondeu agora. A nota foi medida; tente o resumo de novo.';
    return NextResponse.json({ ok: true, avaliacao: av, aviso: erro });
  }
}

async function salvar(conta: string, lead: string, av: AvaliacaoSite) {
  await db()`update leads set site_nota = ${av.nota}, site_avaliacao = ${JSON.stringify(av)}::jsonb, updated_at = now() where conta_id = ${conta} and id = ${lead}`;
}
