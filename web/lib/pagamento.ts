/**
 * Cobrança pela Stripe.
 *
 * Duas formas de pagar o mesmo plano:
 *  - cartão: assinatura que a Stripe renova sozinha todo mês;
 *  - Pix: pagamento avulso que libera 31 dias (Pix na Stripe não renova sozinho).
 *  - 7 dias: pagamento avulso, no cartão ou no Pix, que libera uma semana e não renova.
 *
 * Quem libera o plano é SEMPRE o aviso da Stripe (webhook), conferido pela
 * assinatura criptográfica dela — nunca a volta do navegador para a página
 * de "obrigado", que qualquer um poderia abrir sem ter pago.
 */

import Stripe from 'stripe';
import { db } from './sql';
import { DIAS_DO_PLANO, PLANOS_A_VENDA } from './planos';

export type PlanoPago = 'semanal' | 'basic' | 'pro';
export type Forma = 'cartao' | 'pix';

/** dias de folga depois do vencimento do cartão, para a Stripe tentar cobrar de novo */
const FOLGA_CARTAO_DIAS = 3;

export const pagamentoLigado = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
/** o Pix precisa ser ativado no painel da Stripe; até lá o botão fica escondido para não dar erro */
export const pixLigado = pagamentoLigado && process.env.STRIPE_PIX === '1';

let cliente: Stripe | null = null;
export function stripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error('Pagamento não configurado: falta STRIPE_SECRET_KEY.');
  if (!cliente) cliente = new Stripe(chave);
  return cliente;
}

export function precoCentavos(plano: PlanoPago): number {
  return PLANOS_A_VENDA.find((p) => p.plano === plano)!.precoCentavos;
}

/** o id do preço mensal recorrente de cada plano, criado na Stripe */
function precoRecorrente(plano: 'basic' | 'pro'): string {
  const id = plano === 'basic' ? process.env.STRIPE_PRECO_BASIC : process.env.STRIPE_PRECO_PRO;
  if (!id) throw new Error(`Falta o preço do plano ${plano} na Stripe (STRIPE_PRECO_${plano.toUpperCase()}).`);
  return id;
}

/**
 * O cliente da Stripe desta conta; cria na primeira vez. Se o guardado não
 * existe mais na Stripe (apagado, ou criado no modo de teste e agora a chave é
 * a real), cria outro em vez de travar o pagamento.
 */
async function clienteDaConta(contaId: string, email: string): Promise<string> {
  const sql = db();
  const r = await sql`select stripe_cliente_id from contas where id = ${contaId}`;
  const guardado = r[0]?.stripe_cliente_id as string | undefined;
  if (guardado) {
    try {
      const c = await stripe().customers.retrieve(guardado);
      if (!('deleted' in c && c.deleted)) return guardado;
    } catch {
      // não existe nesta conta da Stripe: segue e cria um novo
    }
  }
  const c = await stripe().customers.create({ email, metadata: { conta_id: contaId } });
  await sql`update contas set stripe_cliente_id = ${c.id} where id = ${contaId}`;
  return c.id;
}

/** anota que a pessoa abriu a página de pagamento: é assim que a central sabe quem desistiu da compra */
async function anotarCheckout(id: string, opts: { contaId: string; plano: PlanoPago; forma: Forma }): Promise<void> {
  await db()`
    insert into checkouts (id, conta_id, plano, forma) values (${id}, ${opts.contaId}, ${opts.plano}, ${opts.forma})
    on conflict (id) do nothing
  `.catch((e) => console.error('[checkout anotar]', e));
}

/** abre a tela de pagamento da Stripe e devolve o endereço para mandar a pessoa */
export async function abrirPagamento(opts: {
  contaId: string;
  email: string;
  plano: PlanoPago;
  forma: Forma;
  site: string;
}): Promise<string> {
  const customer = await clienteDaConta(opts.contaId, opts.email);
  const meta = { conta_id: opts.contaId, plano: opts.plano, forma: opts.forma };
  const volta = {
    success_url: `${opts.site}/planos?pago=1`,
    cancel_url: `${opts.site}/planos`,
  };

  if (opts.forma === 'cartao' && opts.plano !== 'semanal') {
    const s = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      locale: 'pt-BR',
      allowed_payment_method_types: ['card'],
      line_items: [{ price: precoRecorrente(opts.plano), quantity: 1 }],
      subscription_data: { metadata: meta },
      metadata: meta,
      ...volta,
    });
    await anotarCheckout(s.id, opts);
    return s.url!;
  }

  // pagamento avulso: o Pix de um mês, ou o plano de 7 dias (cartão ou Pix)
  const nome = PLANOS_A_VENDA.find((p) => p.plano === opts.plano)!.nome;
  const s = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer,
    locale: 'pt-BR',
    allowed_payment_method_types: [opts.forma === 'pix' ? 'pix' : 'card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: precoCentavos(opts.plano),
          product_data: { name: opts.plano === 'semanal' ? 'Vertion Leads — 7 dias' : `Vertion Leads ${nome} — 1 mês` },
        },
      },
    ],
    payment_intent_data: { metadata: meta },
    metadata: meta,
    ...volta,
  });
  await anotarCheckout(s.id, opts);
  return s.url!;
}

/** página da Stripe onde o assinante troca o cartão, vê faturas ou cancela */
export async function abrirPortal(contaId: string, site: string): Promise<string | null> {
  const r = await db()`select stripe_cliente_id from contas where id = ${contaId}`;
  const customer = r[0]?.stripe_cliente_id as string | undefined;
  if (!customer) return null;
  const s = await stripe().billingPortal.sessions.create({ customer, return_url: `${site}/conta` });
  return s.url;
}


// ------------------------------------------------------------ aviso

function ehPlanoPago(v: unknown): v is PlanoPago {
  return v === 'semanal' || v === 'basic' || v === 'pro';
}

/** o plano de um preço da Stripe; é pelo preço que se sabe a troca de plano feita no portal */
function planoDoPreco(precoId: string | undefined): 'basic' | 'pro' | null {
  if (!precoId) return null;
  if (precoId === process.env.STRIPE_PRECO_BASIC) return 'basic';
  if (precoId === process.env.STRIPE_PRECO_PRO) return 'pro';
  return null;
}

/** grava o pagamento; devolve false se ele já tinha sido gravado (aviso repetido) */
async function registrarPagamento(p: {
  id: string;
  contaId: string;
  plano: PlanoPago;
  forma: Forma;
  valorCentavos: number;
  descricao: string;
}): Promise<boolean> {
  const r = await db()`
    insert into pagamentos (id, conta_id, plano, forma, valor_centavos, descricao)
    values (${p.id}, ${p.contaId}, ${p.plano}, ${p.forma}, ${p.valorCentavos}, ${p.descricao})
    on conflict (id) do nothing returning id
  `;
  return r.length > 0;
}

/*
 * Troca de plano não pode transformar dias baratos em dias caros: quem tem
 * um ano de Basic pago e compra um mês de Pro não ganha um ano de Pro. O
 * tempo que sobrava é convertido pelo preço (Basic → Pro encolhe, Pro →
 * Basic estica). Mesmo plano: o tempo segue igual.
 *
 * Expressão SQL que devolve a validade "convertida" para o plano novo.
 */
function validadeConvertida(sql: ReturnType<typeof db>, novo: PlanoPago) {
  // compara o preço por dia: o de 7 dias é bem mais caro por dia que o mensal
  const porDia = (p: PlanoPago) => precoCentavos(p) / DIAS_DO_PLANO[p];
  const novoPorDia = porDia(novo);
  return sql`
    case
      when pago_ate is null or pago_ate <= now() then now()
      when plano = ${novo} or (plano = 'pago' and ${novo} = 'pro') then pago_ate
      when plano = 'semanal' then now() + (pago_ate - now()) * (${porDia('semanal')}::float8 / ${novoPorDia}::float8)
      when plano = 'basic' then now() + (pago_ate - now()) * (${porDia('basic')}::float8 / ${novoPorDia}::float8)
      when plano in ('pro', 'pago') then now() + (pago_ate - now()) * (${porDia('pro')}::float8 / ${novoPorDia}::float8)
      else now()
    end
  `;
}

/** pagamento avulso: os dias do plano (31 no Pix mensal, 7 no semanal) a partir do que já estava pago */
async function liberarAvulso(contaId: string, plano: PlanoPago, forma: Forma): Promise<void> {
  const sql = db();
  await sql`
    update contas set
      pago_ate = ${validadeConvertida(sql, plano)} + make_interval(days => ${DIAS_DO_PLANO[plano]}),
      plano = case when plano = 'cortesia' then plano else ${plano} end,
      forma_pagamento = case when stripe_assinatura_id is null then ${forma} else forma_pagamento end
    where id = ${contaId}
  `;
}

/**
 * Cartão: deixa a conta igual ao que a assinatura da Stripe diz. O plano sai
 * SÓ do preço (um preço desconhecido não libera plano nenhum), o cancelamento
 * agendado fica anotado para a tela avisar, e a validade só avança quando uma
 * fatura é paga de verdade — o aviso de "período novo" chega antes da
 * cobrança, e um cartão recusado depois não pode ter ganhado o mês.
 */
async function sincronizarAssinatura(sub: Stripe.Subscription, pagouAgora: boolean): Promise<string | null> {
  const contaId = sub.metadata?.conta_id;
  if (!contaId) return null;
  const item = sub.items.data[0];
  const plano = planoDoPreco(item?.price?.id);
  const sql = db();

  const encerrada = ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status);
  if (encerrada || !plano) {
    await sql`update contas set stripe_assinatura_id = null, assinatura_cancela_em = null where id = ${contaId} and stripe_assinatura_id = ${sub.id}`;
    return contaId;
  }

  const fim = item?.current_period_end;
  const cancelaEm = sub.cancel_at_period_end && fim ? new Date(fim * 1000) : sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;

  if (pagouAgora && fim) {
    const ate = new Date((fim + FOLGA_CARTAO_DIAS * 86400) * 1000);
    await sql`
      update contas set
        pago_ate = greatest(${validadeConvertida(sql, plano)}, ${ate}::timestamptz),
        plano = case when plano = 'cortesia' then plano else ${plano} end,
        forma_pagamento = 'cartao',
        stripe_assinatura_id = ${sub.id},
        assinatura_cancela_em = ${cancelaEm},
        pagamento_falhou = false
      where id = ${contaId}
    `;
  } else {
    // troca de plano no portal ou cancelamento agendado: muda o plano, não a validade
    await sql`
      update contas set
        plano = case when plano = 'cortesia' then plano else ${plano} end,
        forma_pagamento = 'cartao',
        stripe_assinatura_id = ${sub.id},
        assinatura_cancela_em = ${cancelaEm}
      where id = ${contaId}
    `;
  }
  return contaId;
}

function idDaAssinatura(fatura: Stripe.Invoice): string | null {
  // contas com versão antiga da API mandam a assinatura direto na fatura
  const antiga = (fatura as unknown as { subscription?: string | { id: string } }).subscription;
  const ref = fatura.parent?.subscription_details?.subscription ?? antiga;
  return typeof ref === 'string' ? ref : (ref?.id ?? null);
}

/**
 * Trata um aviso da Stripe já conferido. Devolve false quando o mesmo aviso
 * já tinha sido processado (a Stripe reenvia em caso de dúvida).
 *
 * Se algo falhar no meio, o registro do aviso é desfeito: a Stripe tenta de
 * novo e a nova tentativa processa de verdade — senão o cliente pagaria e o
 * plano nunca seria liberado. Cada passo é seguro de repetir (o pagamento
 * tem id próprio e só libera dias na primeira vez que é gravado).
 */
export async function tratarAviso(evento: Stripe.Event): Promise<boolean> {
  const sql = db();
  const novo = await sql`
    insert into eventos_pagamento (id, tipo, corpo)
    values (${evento.id}, ${evento.type}, ${JSON.stringify(evento.data.object)}::jsonb)
    on conflict (id) do nothing returning id
  `;
  if (!novo.length) return false;

  try {
    const contaId = await processarAviso(evento);
    if (contaId) await sql`update eventos_pagamento set conta_id = ${contaId} where id = ${evento.id}`;
    return true;
  } catch (err) {
    await sql`delete from eventos_pagamento where id = ${evento.id}`.catch(() => {});
    throw err;
  }
}

async function processarAviso(evento: Stripe.Event): Promise<string | null> {
  const sql = db();
  switch (evento.type) {
    // Pix pago na hora, ou a confirmação que chega depois (Pix pode ser assíncrono)
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = evento.data.object as Stripe.Checkout.Session;
      // a compra iniciada vira compra feita (cartão ou Pix, mensal ou avulso)
      if (s.payment_status === 'paid') {
        await sql`update checkouts set pago_em = coalesce(pago_em, now()) where id = ${s.id}`;
      }
      if (s.mode !== 'payment' || s.payment_status !== 'paid') return null;
      const plano = s.metadata?.plano;
      const contaId = s.metadata?.conta_id;
      if (!contaId || !ehPlanoPago(plano)) return null;
      // confere que o valor pago é o do plano: metadado sozinho não prova nada
      if ((s.amount_total ?? 0) < precoCentavos(plano)) return null;
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? s.id);
      const forma: Forma = s.metadata?.forma === 'cartao' ? 'cartao' : 'pix';
      const descricao = `${forma === 'pix' ? 'Pix' : 'Cartão'} · ${plano === 'semanal' ? '7 dias' : '1 mês'}`;
      // grava primeiro: o mesmo pagamento nunca libera os dias duas vezes
      const primeiraVez = await registrarPagamento({ id: pi, contaId, plano, forma, valorCentavos: s.amount_total ?? 0, descricao });
      if (primeiraVez) await liberarAvulso(contaId, plano, forma);
      return contaId;
    }
    // cartão: cada fatura paga (a primeira e as renovações) estende o plano
    case 'invoice.paid': {
      const fatura = evento.data.object as Stripe.Invoice;
      const subId = idDaAssinatura(fatura);
      if (!subId) return null;
      const sub = await stripe().subscriptions.retrieve(subId);
      const plano = planoDoPreco(sub.items.data[0]?.price?.id);
      const contaId = sub.metadata?.conta_id;
      if (contaId && plano && (fatura.amount_paid ?? 0) > 0) {
        await registrarPagamento({
          id: fatura.id!,
          contaId,
          plano,
          forma: 'cartao',
          valorCentavos: fatura.amount_paid,
          descricao: fatura.billing_reason === 'subscription_create' ? 'Cartão · primeira mensalidade' : 'Cartão · renovação',
        });
      }
      return sincronizarAssinatura(sub, true);
    }
    // cartão recusado na renovação: a tela avisa para trocar o cartão antes de o plano vencer
    case 'invoice.payment_failed': {
      const subId = idDaAssinatura(evento.data.object as Stripe.Invoice);
      if (!subId) return null;
      const r = await sql`update contas set pagamento_falhou = true where stripe_assinatura_id = ${subId} returning id`;
      return (r[0]?.id as string) ?? null;
    }
    // troca de plano ou cancelamento agendado feitos no portal. Busca a assinatura
    // de novo na Stripe: avisos podem chegar fora de ordem, e um "atualizada"
    // velho não pode ressuscitar uma assinatura já encerrada.
    case 'customer.subscription.updated': {
      const sub = await stripe().subscriptions.retrieve((evento.data.object as Stripe.Subscription).id);
      return sincronizarAssinatura(sub, false);
    }
    // assinatura encerrada: o plano corre até o fim do que já foi pago e volta ao Free sozinho
    case 'customer.subscription.deleted': {
      const sub = evento.data.object as Stripe.Subscription;
      const r = await sql`
        update contas set stripe_assinatura_id = null, assinatura_cancela_em = null
        where stripe_assinatura_id = ${sub.id} returning id
      `;
      return (r[0]?.id as string) ?? null;
    }
  }
  return null;
}

export interface SituacaoCobranca {
  forma: Forma | null;
  temPortal: boolean;
  assinaturaAtiva: boolean;
  cancelaEm: string | null;
  pagamentoFalhou: boolean;
}

/** como a conta paga hoje, para as telas mostrarem o botão e o aviso certos */
export async function situacaoDaCobranca(contaId: string): Promise<SituacaoCobranca> {
  const r = await db()`
    select forma_pagamento, stripe_cliente_id, stripe_assinatura_id, assinatura_cancela_em, pagamento_falhou
    from contas where id = ${contaId}
  `;
  const c = r[0] || {};
  return {
    forma: (c.forma_pagamento as Forma) ?? null,
    temPortal: Boolean(c.stripe_cliente_id),
    assinaturaAtiva: Boolean(c.stripe_assinatura_id),
    cancelaEm: c.assinatura_cancela_em ? new Date(c.assinatura_cancela_em).toISOString() : null,
    pagamentoFalhou: Boolean(c.pagamento_falhou),
  };
}

export interface LinhaPagamento {
  id: string;
  plano: PlanoPago;
  forma: Forma;
  valorCentavos: number;
  pagoEm: string;
  descricao: string | null;
}

/** os pagamentos da própria conta, do mais novo para o mais antigo */
export async function pagamentosDaConta(contaId: string, limite = 24): Promise<LinhaPagamento[]> {
  const r = await db()`
    select id, plano, forma, valor_centavos, pago_em, descricao from pagamentos
    where conta_id = ${contaId} order by pago_em desc limit ${limite}
  `;
  return r.map((x) => ({
    id: x.id,
    plano: x.plano,
    forma: x.forma,
    valorCentavos: x.valor_centavos,
    pagoEm: new Date(x.pago_em).toISOString(),
    descricao: x.descricao,
  }));
}

/** cancela na hora a assinatura no cartão (usado quando a pessoa exclui a conta); falhou, lança erro e a conta NÃO é apagada */
export async function cancelarAssinaturaJa(contaId: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const r = await db()`select stripe_assinatura_id from contas where id = ${contaId}`;
  const sub = r[0]?.stripe_assinatura_id as string | undefined;
  if (!sub) return;
  try {
    await stripe().subscriptions.cancel(sub);
  } catch (err) {
    // já cancelada ou inexistente na Stripe: nada mais a cobrar
    const codigo = (err as { code?: string }).code;
    if (codigo !== 'resource_missing' && !/canceled/i.test(String((err as Error).message))) throw err;
  }
}

export interface AvisoVencimento {
  tipo: 'vence' | 'cancelada' | 'cartao' | 'venceu';
  plano: 'semanal' | 'basic' | 'pro';
  /** quando vence (ou venceu), ISO */
  data: string;
  /** dias inteiros até vencer; negativo = já venceu */
  dias: number;
}

/**
 * O aviso de vencimento do topo do painel. O Pix e o plano de 7 dias não
 * renovam sozinhos: sem aviso, a pessoa só descobre quando a busca para.
 * Também avisa assinatura cancelada perto do fim, cartão recusado e plano que
 * venceu há pouco (para quem já pagou não ler "seu teste grátis acabou").
 */
export async function avisoDeVencimento(contaId: string): Promise<AvisoVencimento | null> {
  const [c] = await db()`
    select plano, pago_ate, stripe_assinatura_id, assinatura_cancela_em, pagamento_falhou
    from contas where id = ${contaId}
  `;
  if (!c || !c.pago_ate || !['semanal', 'basic', 'pro', 'pago'].includes(c.plano)) return null;
  const plano = (c.plano === 'pago' ? 'pro' : c.plano) as AvisoVencimento['plano'];
  const ate = new Date(c.pago_ate);
  const dias = Math.ceil((ate.getTime() - Date.now()) / 86_400_000);
  const base = { plano, data: ate.toISOString(), dias };

  if (dias <= 0) return dias >= -30 ? { tipo: 'venceu', ...base } : null;
  if (c.pagamento_falhou) return { tipo: 'cartao', ...base };
  if (c.stripe_assinatura_id) {
    return c.assinatura_cancela_em && dias <= 7 ? { tipo: 'cancelada', ...base } : null;
  }
  return dias <= 3 ? { tipo: 'vence', ...base } : null;
}
