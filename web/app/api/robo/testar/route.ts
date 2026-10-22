import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { normalizarConfig } from '@/lib/robo-config';
import { decidir, linksPermitidos, mensagensSeguras, montarInstrucoes, montarPedido, type FalaParaIa, type LeadParaIa } from '@/lib/robo-cerebro';
import { escritaDoDono, LIMITE_POR_DIA, pedidosHoje, registrarUso, treinoDoRobo } from '@/lib/robo';
import { ErroGemini, geminiLigado } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * "Testar o robô": você faz o papel do cliente e vê o que ele responderia,
 * com o treino que está na tela (mesmo antes de salvar). Nada vai para o
 * WhatsApp. { config, lead, conversa: [{ autor, texto }] }
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  if (!geminiLigado()) return NextResponse.json({ ok: false, erro: 'Falta a chave do Gemini (GEMINI_API_KEY) na Vercel.' }, { status: 503 });
  if (await estourou('robo-teste:' + s.sessao.userId, 20, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitos testes seguidos. Espere um minuto.' }, { status: 429 });
  }
  const conta = s.sessao.contaId;
  if ((await pedidosHoje(conta)) >= LIMITE_POR_DIA) {
    return NextResponse.json({ ok: false, erro: 'O robô chegou ao limite de respostas de hoje.' }, { status: 429 });
  }

  const corpo = (await req.json().catch(() => ({}))) as {
    config?: unknown;
    lead?: { tipo?: string; nome?: string; ramo?: string; cidade?: string; previa?: boolean; proposta?: boolean };
    conversa?: { autor?: string; texto?: string }[];
  };
  const salvo = await treinoDoRobo(conta);
  const cfg = corpo.config ? normalizarConfig(corpo.config) : salvo.cfg;
  const l = corpo.lead || {};
  const site = (process.env.SITE_URL || 'https://leads.vertionstack.com').replace(/\/$/, '');
  const lead: LeadParaIa = {
    tipo: l.tipo === 'pessoa' ? 'pessoa' : 'comercio',
    nome: String(l.nome || 'Barbearia do Zé').slice(0, 120),
    ramo: String(l.ramo || '').slice(0, 80) || null,
    cidade: String(l.cidade || '').slice(0, 80) || null,
    problema: l.tipo === 'pessoa' ? null : 'vocês ainda não têm site',
    avaliacoes: null,
    interesse: [],
    ideia: null,
    previa: l.previa ? `${site}/s/exemplo/previa-de-teste` : null,
    proposta: l.proposta ? `${site}/p/exemplo/proposta-de-teste` : null,
    valores: l.proposta ? 'entrada R$ 590,00, mensalidade R$ 60,00 (valores de exemplo do teste)' : null,
  };
  const conversa: FalaParaIa[] = (Array.isArray(corpo.conversa) ? corpo.conversa : [])
    .slice(-30)
    .map((m) => ({ autor: m?.autor === 'cliente' ? ('cliente' as const) : ('eu' as const), texto: String(m?.texto || '').slice(0, 1000) }))
    .filter((m) => m.texto.trim());
  if (!conversa.length || conversa[conversa.length - 1].autor !== 'cliente') {
    return NextResponse.json({ ok: false, erro: 'Escreva a mensagem do cliente para o robô responder.' }, { status: 400 });
  }

  try {
    const r = await decidir(montarInstrucoes(cfg, salvo.empresa, salvo.oferta, await escritaDoDono(conta)), montarPedido(lead, conversa, [], null), false);
    await registrarUso(conta, 'teste', r);
    const seguras = r.decisao.acao === 'nada' ? [] : mensagensSeguras(r.decisao.mensagens, linksPermitidos(lead, cfg, null));
    return NextResponse.json({ ok: true, decisao: r.decisao, bloqueada: seguras === null });
  } catch (e) {
    const erro = e instanceof ErroGemini ? e.message : 'O Gemini não respondeu agora.';
    return NextResponse.json({ ok: false, erro }, { status: 502 });
  }
}
