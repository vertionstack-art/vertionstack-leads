/**
 * O robô de vendas do WhatsApp (só a conta da Vertion).
 *
 * Regras combinadas com o dono:
 * - A primeira mensagem é sempre dele, com o clique. O robô só responde a
 *   quem respondeu, e só em conversa que ele começou pela ferramenta.
 * - Nunca inventa preço, desconto, prazo, resultado ou promessa. Valor só o
 *   da proposta que ele montou; prévia e proposta só as que existem.
 * - Quando precisa dele (prévia que ainda não existe, negociação, marcar a
 *   chamada, áudio, algo que não sabe), responde algo curto, abre um aviso e
 *   espera. Ele entrega pelo "Entregar ao robô" e a conversa segue.
 * - Se ele responde por conta própria, o robô pausa naquela conversa.
 * - Se perguntam se é robô, diz a verdade. Se o cliente pede para parar, para.
 * - Espera o cliente terminar de digitar (uns 25 s sem mensagem nova), mais
 *   um intervalo que varia, marca como lida e responde em balões curtos com
 *   "digitando...". Só no horário definido no treino (padrão 8h às 21h); o
 *   que chega fora disso é respondido às 9h (cron).
 *
 * O que ele sabe e o jeito de escrever vêm do treino (lib/robo-config); as
 * instruções e a conferência da resposta ficam em lib/robo-cerebro.
 */

import { db } from './sql';
import { buscarLead, atualizarLead, type Lead } from './db';
import { registrarEvento } from './eventos';
import { registrarMensagem, mensagensDaConversa, passosFeitos, marcarPasso } from './conversa';
import { dadosDoLead } from './conversa-contexto';
import { enviarTexto, evolutionLigada, marcarComoLida } from './evolution';
import { numeroWhatsapp } from './telefone';
import { valores, type CfgProposta } from './financeiro';
import { rotuloDoInteresse } from './interesses';
import { ErroIa, cabecaLigada } from './cabeca';
import { ajustarParaAutomatica, decidir, linksPermitidos, mensagensSeguras, montarInstrucoes, montarPedido, type Decisao, type FalaParaIa, type LeadParaIa } from './robo-cerebro';
import { normalizarConfig, type ConfigRobo } from './robo-config';
import type { Aguardando, AvisoRobo, EstadoRobo } from './robo-tipos';
import { ehAutomatica, segundosDepois } from './automatica';

/** quanto esperar o cliente terminar de digitar antes de responder */
const ESPERA_MS = 25_000;
/** respostas do robô por conversa, por dia: passou disso é conversa estranha, chama a pessoa */
const MAX_POR_CONVERSA = 30;
/** pedidos à IA do robô por dia na conta inteira (o Gemini grátis tem limite diário) */
const MAX_POR_DIA = Number(process.env.ROBO_MAX_DIA) || 200;

export { ROTULO_AGUARDANDO } from './robo-tipos';
export type { Aguardando, EstadoRobo, AvisoRobo } from './robo-tipos';

const sql = () => db();

function hojeEmBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** o horário em que o robô responde, definido no treino (padrão 8h às 21h de Brasília) */
function dentroDoHorario(cfg: ConfigRobo): boolean {
  const h = new Date(Date.now() - 3 * 3600 * 1000).getUTCHours();
  return h >= cfg.horaInicio && h < cfg.horaFim;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ estado

export async function roboAtivoNaConta(conta: string): Promise<boolean> {
  const [r] = await sql()`select robo_ativo from contas where id = ${conta}`;
  return Boolean(r?.robo_ativo);
}

export async function ligarRoboNaConta(conta: string, ativo: boolean): Promise<void> {
  await sql()`update contas set robo_ativo = ${ativo} where id = ${conta}`;
}

export async function estadoDoRobo(conta: string, lead: string): Promise<EstadoRobo> {
  const [r] = await sql()`
    select c.robo_ativo, rc.ligado, rc.aguardando, rc.aguardando_motivo, rc.aguardando_desde, rc.pausado_motivo,
      case when rc.respostas_dia = ${hojeEmBrasilia()}::date then rc.respostas_no_dia else 0 end as hoje
    from contas c
    left join robo_conversas rc on rc.conta_id = c.id and rc.lead_id = ${lead}
    where c.id = ${conta}
  `;
  return {
    ativoNaConta: Boolean(r?.robo_ativo),
    pronto: cabecaLigada() && evolutionLigada(),
    ligado: Boolean(r?.ligado),
    aguardando: (r?.aguardando as Aguardando) || null,
    aguardandoMotivo: (r?.aguardando_motivo as string) || null,
    aguardandoDesde: r?.aguardando_desde ? new Date(r.aguardando_desde).toISOString() : null,
    pausadoMotivo: (r?.pausado_motivo as string) || null,
    respostasHoje: Number(r?.hoje) || 0,
  };
}

/** o botão "Robô nesta conversa"; ligar de novo limpa a pausa */
export async function ligarRoboNaConversa(conta: string, lead: string, ligado: boolean): Promise<void> {
  await sql()`
    insert into robo_conversas (conta_id, lead_id, ligado) values (${conta}, ${lead}, ${ligado})
    on conflict (conta_id, lead_id) do update set ligado = excluded.ligado,
      pausado_motivo = case when excluded.ligado then null else 'desligado por você' end,
      atualizado_em = now()
  `;
}

/**
 * A pessoa mandou uma mensagem por conta própria (pelo botão da ferramenta
 * ou pelo celular). Na primeira mensagem da conversa o robô fica de prontidão
 * (se estiver ligado na conta); depois que ele já falou, a pessoa assumiu e
 * o robô pausa naquela conversa.
 */
export async function aoMandarPorContaPropria(conta: string, lead: string): Promise<void> {
  const [linha] = await sql()`
    select ligado, processando_ate > now() as ocupado from robo_conversas where conta_id = ${conta} and lead_id = ${lead}
  `;
  if (!linha) {
    await sql()`
      insert into robo_conversas (conta_id, lead_id, ligado)
      select ${conta}, ${lead}, robo_ativo from contas where id = ${conta}
      on conflict do nothing
    `;
    return;
  }
  // a mensagem que o próprio robô acabou de mandar também volta pelo webhook: não conta
  if (!linha.ligado || linha.ocupado) return;
  const [falou] = await sql()`select 1 as x from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead} and robo limit 1`;
  if (!falou) return;
  await sql()`
    update robo_conversas set ligado = false, pausado_motivo = 'você respondeu', atualizado_em = now()
    where conta_id = ${conta} and lead_id = ${lead}
  `;
}

// ------------------------------------------------------------------ avisos

export async function avisosAbertos(conta: string): Promise<AvisoRobo[]> {
  const r = await sql()`
    select a.id, a.lead_id, a.tipo, a.texto, a.criado_em, l.name
    from robo_avisos a join leads l on l.conta_id = a.conta_id and l.id = a.lead_id
    where a.conta_id = ${conta} and a.resolvido_em is null
    order by a.criado_em desc
    limit 50
  `;
  return r.map((x) => ({
    id: Number(x.id),
    leadId: x.lead_id as string,
    nome: x.name as string,
    tipo: x.tipo as string,
    texto: x.texto as string,
    em: new Date(x.criado_em).toISOString(),
  }));
}

async function avisar(conta: string, lead: string, tipo: string, texto: string): Promise<void> {
  // um aviso aberto por conversa: o novo substitui o anterior
  await sql()`update robo_avisos set resolvido_em = now() where conta_id = ${conta} and lead_id = ${lead} and resolvido_em is null`;
  await sql()`insert into robo_avisos (conta_id, lead_id, tipo, texto) values (${conta}, ${lead}, ${tipo}, ${texto.slice(0, 300)})`;
}

/** "Resolvi eu mesmo": o robô para de esperar e volta a responder */
export async function resolverEspera(conta: string, lead: string): Promise<void> {
  await sql()`
    update robo_conversas set aguardando = null, aguardando_motivo = null, aguardando_desde = null, atualizado_em = now()
    where conta_id = ${conta} and lead_id = ${lead}
  `;
  await sql()`update robo_avisos set resolvido_em = now() where conta_id = ${conta} and lead_id = ${lead} and resolvido_em is null`;
}

// ------------------------------------------------------------------ o que ele sabe

export interface Treino {
  cfg: ConfigRobo;
  empresa: string;
  oferta: string;
}

/** o que o dono ensinou, com o nome da empresa e o que ela vende (Meu perfil) */
export async function treinoDoRobo(conta: string): Promise<Treino> {
  const [c] = await sql()`select robo_config, empresa_nome, oferta, oferta_texto from contas where id = ${conta}`;
  return {
    cfg: normalizarConfig(c?.robo_config),
    empresa: (c?.empresa_nome as string) || 'Vertion Stack',
    oferta: (c?.oferta_texto as string) || (c?.oferta as string) || 'sites',
  };
}

export async function salvarTreino(conta: string, cfg: ConfigRobo): Promise<void> {
  await sql()`update contas set robo_config = ${sql().json(JSON.parse(JSON.stringify(cfg)))} where id = ${conta}`;
}

/** mensagens que o dono escreveu de verdade pela ferramenta: o robô copia o jeito */
export async function escritaDoDono(conta: string): Promise<string[]> {
  const r = await sql()`
    select distinct on (texto) texto, criado_em from conversa_mensagens
    where conta_id = ${conta} and autor = 'eu' and not robo and length(texto) between 15 and 400
    order by texto, criado_em desc
    limit 200
  `;
  return r
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    .slice(0, 12)
    .map((x) => String(x.texto).replace(/\s+/g, ' '));
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function siteDaFerramenta(): string {
  return (process.env.SITE_URL || 'https://leads.vertionstack.com').replace(/\/$/, '');
}

interface Contexto {
  lead: Lead;
  instrucoes: string;
  pedido: string;
  /** a conversa como foi para a IA (com as respostas automáticas marcadas) */
  conversa: FalaParaIa[];
  links: string[];
  ultimoClienteId: number;
  /** ids do WhatsApp das mensagens do cliente ainda sem resposta, para marcar como lidas */
  naoLidas: string[];
  ultimoAutor: 'eu' | 'cliente' | null;
}

async function montarContexto(conta: string, leadId: string, entrega: string | null, treino: Treino): Promise<Contexto | null> {
  const lead = await buscarLead(conta, leadId);
  if (!lead) return null;
  const d = await dadosDoLead(conta, treino.cfg.nome, lead, siteDaFerramenta());
  const v = valores(lead.proposta as CfgProposta | null);
  const mensagens = (await mensagensDaConversa(conta, leadId)).slice(-40);
  const passos = await passosFeitos(conta, leadId);
  const ultimoCliente = [...mensagens].reverse().find((m) => m.autor === 'cliente');
  const [respondido] = await sql()`select respondido_ate from robo_conversas where conta_id = ${conta} and lead_id = ${leadId}`;
  const naoLidas = await sql()`
    select externo_id from conversa_mensagens
    where conta_id = ${conta} and lead_id = ${leadId} and autor = 'cliente' and externo_id is not null and id > ${Number(respondido?.respondido_ate) || 0}
  `;

  const paraIa: LeadParaIa = {
    tipo: lead.tipo,
    nome: lead.name,
    ramo: lead.category,
    cidade: lead.city,
    problema: lead.tipo === 'pessoa' ? null : d.problema,
    avaliacoes: d.avaliacoes,
    interesse: lead.interesse.map(rotuloDoInteresse),
    ideia: lead.ideia,
    previa: d.previa,
    proposta: d.proposta,
    valores: v && (v.entrada || v.mensalidade) ? `entrada ${brl(v.entrada)}${v.mensalidade ? `, mensalidade ${brl(v.mensalidade)}` : ', sem mensalidade'}` : null,
  };
  // resposta automática do WhatsApp Business (boas-vindas, menu, ausência): o robô não responde o conteúdo
  let nossaAnterior: string | null = null;
  const conversa = mensagens.map((m) => {
    const automatica = m.autor === 'cliente' && ehAutomatica(m.texto, segundosDepois(m.em, nossaAnterior));
    if (m.autor === 'eu') nossaAnterior = m.em;
    return {
      autor: m.autor,
      texto: m.texto,
      automatica,
      em: new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    };
  });

  return {
    lead,
    instrucoes: montarInstrucoes(treino.cfg, treino.empresa, treino.oferta, await escritaDoDono(conta)),
    pedido: montarPedido(paraIa, conversa, passos, entrega),
    conversa,
    links: linksPermitidos(paraIa, treino.cfg, entrega),
    ultimoClienteId: ultimoCliente?.id || 0,
    naoLidas: naoLidas.map((x) => x.externo_id as string),
    ultimoAutor: mensagens.length ? mensagens[mensagens.length - 1].autor : null,
  };
}

// ------------------------------------------------------------------ responder

async function travar(conta: string, lead: string): Promise<boolean> {
  const r = await sql()`
    update robo_conversas set processando_ate = now() + interval '150 seconds'
    where conta_id = ${conta} and lead_id = ${lead} and (processando_ate is null or processando_ate < now())
    returning lead_id
  `;
  return r.length > 0;
}

async function destravar(conta: string, lead: string): Promise<void> {
  await sql()`update robo_conversas set processando_ate = null where conta_id = ${conta} and lead_id = ${lead}`;
}

/** pedidos à IA do robô hoje (conversas de verdade e testes); o Claude da conversa guiada fica de fora */
export async function pedidosHoje(conta: string): Promise<number> {
  const [r] = await sql()`
    select count(*)::int as n from uso_ia
    where conta_id = ${conta} and modelo not like 'claude%'
      and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
  `;
  return (r?.n as number) || 0;
}

export const LIMITE_POR_DIA = MAX_POR_DIA;

export type Resultado =
  | { feito: 'respondeu' | 'chamou' | 'encerrou' | 'nada'; mensagem: string | null }
  | { feito: 'pulou'; motivo: string }
  | { feito: 'erro'; motivo: string };

/**
 * O webhook chama isto depois que o cliente mandou mensagem (com `gatilho`, o
 * id da mensagem, para esperar ele terminar de digitar); o cron e o botão
 * "Responder agora" chamam sem gatilho.
 */
export async function responderSePrecisar(conta: string, leadId: string, gatilho?: number, forcar = false): Promise<Resultado> {
  if (gatilho) {
    await dormir(ESPERA_MS);
    const [ultimo] = await sql()`
      select max(id)::bigint as id from conversa_mensagens where conta_id = ${conta} and lead_id = ${leadId} and autor = 'cliente'
    `;
    // chegou mensagem mais nova: quem responde é o webhook dela
    if (Number(ultimo?.id) !== gatilho) return { feito: 'pulou', motivo: 'chegou mensagem mais nova' };
  }

  const [estado] = await sql()`
    select c.robo_ativo, rc.ligado, rc.aguardando, rc.respondido_ate,
      case when rc.respostas_dia = ${hojeEmBrasilia()}::date then rc.respostas_no_dia else 0 end as hoje
    from contas c join robo_conversas rc on rc.conta_id = c.id and rc.lead_id = ${leadId}
    where c.id = ${conta}
  `;
  if (!estado?.robo_ativo || !estado.ligado) return { feito: 'pulou', motivo: 'robô desligado' };
  if (estado.aguardando && !forcar) return { feito: 'pulou', motivo: 'esperando você' };
  if (!cabecaLigada() || !evolutionLigada()) return { feito: 'pulou', motivo: 'falta configurar' };
  const treino = await treinoDoRobo(conta);
  if (!forcar && !dentroDoHorario(treino.cfg)) return { feito: 'pulou', motivo: 'fora do horário' };

  // gente não responde sempre no mesmo segundo: mais um intervalo que varia
  if (gatilho) await dormir(4000 + Math.random() * 14000);

  // outra resposta em andamento: espera até meio minuto ela terminar
  let travado = await travar(conta, leadId);
  for (let i = 0; !travado && i < 6; i++) {
    await dormir(5000);
    travado = await travar(conta, leadId);
  }
  if (!travado) return { feito: 'pulou', motivo: 'ocupado' };

  try {
    const ctx = await montarContexto(conta, leadId, null, treino);
    if (!ctx) return { feito: 'pulou', motivo: 'lead não existe' };
    if (ctx.ultimoAutor !== 'cliente') return { feito: 'pulou', motivo: 'última mensagem não é do cliente' };
    if (ctx.ultimoClienteId <= Number(estado.respondido_ate)) return { feito: 'pulou', motivo: 'já respondido' };

    if (Number(estado.hoje) >= MAX_POR_CONVERSA) {
      await pararParaVoce(conta, leadId, ctx.ultimoClienteId, 'humano', 'Conversa longa hoje: o robô parou de responder para você assumir.');
      return { feito: 'chamou', mensagem: null };
    }
    if ((await pedidosHoje(conta)) >= MAX_POR_DIA) {
      await pararParaVoce(conta, leadId, ctx.ultimoClienteId, 'humano', 'O robô chegou ao limite de respostas de hoje. Responda você.');
      return { feito: 'chamou', mensagem: null };
    }

    return await decidirEEnviar(conta, ctx, null);
  } catch (e) {
    console.error('[robo]', e);
    return { feito: 'erro', motivo: e instanceof Error ? e.message : 'falha' };
  } finally {
    await destravar(conta, leadId);
  }
}

/** "Entregar ao robô": o que a pessoa preparou (link da prévia, valor, resposta) vira mensagem natural */
export async function entregarAoRobo(conta: string, leadId: string, entrega: string, quem: string): Promise<Resultado> {
  if (!cabecaLigada() || !evolutionLigada()) return { feito: 'erro', motivo: 'Falta configurar a IA do robô ou o WhatsApp.' };
  await sql()`
    insert into robo_conversas (conta_id, lead_id, ligado) values (${conta}, ${leadId}, true)
    on conflict (conta_id, lead_id) do update set ligado = true, pausado_motivo = null
  `;
  if (!(await travar(conta, leadId))) return { feito: 'erro', motivo: 'O robô está respondendo agora. Tente de novo em alguns segundos.' };
  try {
    const ctx = await montarContexto(conta, leadId, entrega, await treinoDoRobo(conta));
    if (!ctx) return { feito: 'erro', motivo: 'Lead não encontrado.' };
    await resolverEspera(conta, leadId);
    const r = await decidirEEnviar(conta, ctx, entrega);
    if (r.feito === 'respondeu') await registrarEvento(conta, leadId, 'nota', 'Você entregou ao robô e ele mandou ao cliente', quem);
    return r;
  } catch (e) {
    console.error('[robo]', e);
    return { feito: 'erro', motivo: e instanceof Error ? e.message : 'falha' };
  } finally {
    await destravar(conta, leadId);
  }
}

/** grava o uso no medidor (a IA do PC e o Gemini grátis não custam nada, mas contam para o limite do dia) */
export async function registrarUso(conta: string, leadId: string, r: { modelo: string; entrada: number; saida: number }): Promise<void> {
  await sql()`
    insert into uso_ia (conta_id, lead_id, modelo, entrada, saida, cache_lida, cache_gravada, custo_usd)
    values (${conta}, ${leadId}, ${r.modelo}, ${r.entrada}, ${r.saida}, 0, 0, 0)
  `;
}

async function decidirEEnviar(conta: string, ctx: Contexto, entrega: string | null): Promise<Resultado> {
  const leadId = ctx.lead.id;
  let d: Decisao;
  try {
    const r = await decidir(ctx.instrucoes, ctx.pedido, Boolean(entrega));
    d = ajustarParaAutomatica(r.decisao, ctx.conversa);
    await registrarUso(conta, leadId, r);
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.message : 'A IA falhou.';
    await pararParaVoce(conta, leadId, ctx.ultimoClienteId, 'humano', `O robô não conseguiu responder: ${motivo} Responda você ou clique em "Responder agora".`);
    return { feito: 'erro', motivo };
  }

  const numero = ctx.lead.whatsapp || (ctx.lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(ctx.lead.phone));
  if (!numero) return { feito: 'erro', motivo: 'O lead não tem celular.' };
  // os dois tiques azuis antes de responder, como gente; se falhar, segue
  await marcarComoLida(numero, ctx.naoLidas).catch(() => undefined);

  if (d.acao === 'nada') {
    await marcarRespondido(conta, leadId, ctx.ultimoClienteId, false);
    return { feito: 'nada', mensagem: null };
  }

  const baloes = mensagensSeguras(d.mensagens, ctx.links);
  if (!baloes) {
    // a IA escreveu algo que não pode sair (link inventado, marcador): a pessoa decide
    await pararParaVoce(conta, leadId, ctx.ultimoClienteId, 'humano', `O robô não mandou a resposta porque ela tinha um link ou trecho que ele não pode usar. ${d.motivo || d.leitura}`.trim());
    return { feito: 'chamou', mensagem: null };
  }

  const passo = d.passo || null;
  for (const [i, texto] of baloes.entries()) {
    // "digitando..." proporcional ao tamanho; o segundo balão vem logo depois, como quem continua digitando
    const digitando = Math.min(7000, (i === 0 ? 1500 : 900) + texto.length * 45 + Math.random() * 800);
    const enviado = await enviarTexto(numero, texto, digitando);
    await registrarMensagem(conta, leadId, 'eu', texto, i === 0 ? passo : null, enviado.id, true);
  }
  const tudo = baloes.join(' ');
  if (passo) await marcarPasso(conta, leadId, passo, true);
  await registrarEvento(conta, leadId, 'whatsapp', `Robô respondeu: “${tudo.replace(/\s+/g, ' ').slice(0, 160)}”`, 'Robô');
  await marcarRespondido(conta, leadId, ctx.ultimoClienteId, true);

  if (d.acao === 'chamar_dono') {
    const tipo = (d.precisa || 'humano') as Aguardando;
    await sql()`
      update robo_conversas set aguardando = ${tipo}, aguardando_motivo = ${(d.motivo || d.leitura).slice(0, 300)}, aguardando_desde = now()
      where conta_id = ${conta} and lead_id = ${leadId}
    `;
    await avisar(conta, leadId, tipo, d.motivo || d.leitura);
    if (ctx.lead.status === 'contatado') await atualizarLead(conta, leadId, { status: 'negociando' }, 'Robô');
    return { feito: 'chamou', mensagem: tudo };
  }
  if (d.acao === 'encerrar') {
    await sql()`update robo_conversas set ligado = false, pausado_motivo = 'o cliente pediu para parar' where conta_id = ${conta} and lead_id = ${leadId}`;
    await avisar(conta, leadId, 'encerrou', d.motivo || 'O cliente pediu para parar. O robô agradeceu e desligou nesta conversa.');
    return { feito: 'encerrou', mensagem: tudo };
  }
  return { feito: 'respondeu', mensagem: tudo };
}

async function marcarRespondido(conta: string, lead: string, ate: number, contou: boolean): Promise<void> {
  const hoje = hojeEmBrasilia();
  await sql()`
    update robo_conversas set
      respondido_ate = greatest(respondido_ate, ${ate}),
      respostas_no_dia = case when ${contou} then (case when respostas_dia = ${hoje}::date then respostas_no_dia else 0 end) + 1 else respostas_no_dia end,
      respostas_dia = case when ${contou} then ${hoje}::date else respostas_dia end,
      atualizado_em = now()
    where conta_id = ${conta} and lead_id = ${lead}
  `;
}

async function pararParaVoce(conta: string, lead: string, ate: number, tipo: Aguardando, texto: string): Promise<void> {
  await sql()`
    update robo_conversas set aguardando = ${tipo}, aguardando_motivo = ${texto.slice(0, 300)}, aguardando_desde = now(),
      respondido_ate = greatest(respondido_ate, ${ate})
    where conta_id = ${conta} and lead_id = ${lead}
  `;
  await avisar(conta, lead, tipo, texto);
}

// ------------------------------------------------------------------ cron

/** às 9h: responde o que chegou de madrugada, uma conversa por vez */
export async function responderPendentes(conta: string, limite = 20): Promise<number> {
  if (!(await roboAtivoNaConta(conta))) return 0;
  const pendentes = await sql()`
    select rc.lead_id from robo_conversas rc
    where rc.conta_id = ${conta} and rc.ligado and rc.aguardando is null
      and exists (
        select 1 from conversa_mensagens m
        where m.conta_id = rc.conta_id and m.lead_id = rc.lead_id and m.autor = 'cliente' and m.id > rc.respondido_ate
          and m.id = (select max(id) from conversa_mensagens x where x.conta_id = rc.conta_id and x.lead_id = rc.lead_id)
      )
    limit ${limite}
  `;
  let n = 0;
  for (const p of pendentes) {
    const r = await responderSePrecisar(conta, p.lead_id as string);
    if (r.feito !== 'pulou' && r.feito !== 'erro') n++;
  }
  return n;
}
