/**
 * Cobrança pela Stripe.
 *
 * Duas formas de pagar o mesmo plano:
 *  - cartão: assinatura que a Stripe renova sozinha todo mês;
 *  - Pix: pagamento avulso que libera 31 dias (Pix na Stripe não renova sozinho).
 *
 * Quem libera o plano é SEMPRE o aviso da Stripe (webhook), conferido pela
 * assinatura criptográfica dela — nunca a volta do navegador para a página
 * de "obrigado", que qualquer um poderia abrir sem ter pago.
 */

import Stripe from 'stripe';
import { db } from './sql';
import { PLANOS_A_VENDA } from './planos';

export type PlanoPago = 'basic' | 'pro';
export type Forma = 'cartao' | 'pix';

/** dias de folga depois do vencimento do cartão, para a Stripe tentar cobrar de novo */
const FOLGA_CARTAO_DIAS = 3;
/** quanto um Pix libera */
const DIAS_POR_PIX = 31;

export const pagamentoLigado = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

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
function precoRecorrente(plano: PlanoPago): string {
  const id = plano === 'basic' ? process.env.STRIPE_PRECO_BASIC : process.env.STRIPE_PRECO_PRO;
  if (!id) throw new Error(`Falta o preço do plano ${plano} na Stripe (STRIPE_PRECO_${plano.toUpperCase()}).`);
  return id;
}

/** o cliente da Stripe desta conta; cria na primeira vez */
async function clienteDaConta(contaId: string, email: string): Promise<string> {
  const sql = db();
  const r = await sql`select stripe_cliente_id from contas where id = ${contaId}`;
  if (r[0]?.stripe_cliente_id) return r[0].stripe_cliente_id as string;
  const c = await stripe().customers.create({ email, metadata: { conta_id: contaId } });
  await sql`update contas set stripe_cliente_id = ${c.id} where id = ${contaId} and stripe_cliente_id is null`;
  const de = await sql`select stripe_cliente_id from contas where id = ${contaId}`;
  return de[0].stripe_cliente_id as string;
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

  if (opts.forma === 'cartao') {
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
    return s.url!;
  }

  const nome = PLANOS_A_VENDA.find((p) => p.plano === opts.plano)!.nome;
  const s = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer,
    locale: 'pt-BR',
    allowed_payment_method_types: ['pix'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: precoCentavos(opts.plano),
          product_data: { name: `Vertion Leads ${nome} — 1 mês` },
        },
      },
    ],
    payment_intent_data: { metadata: meta },
    metadata: meta,
    ...volta,
  });
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
  return v === 'basic' || v === 'pro';
}

/** soma 31 dias a partir do que já estava pago (ou de hoje, se já venceu) */
async function liberarPix(contaId: string, plano: PlanoPago): Promise<void> {
  await db()`
    update contas set
      plano = case when plano = 'cortesia' then plano else ${plano} end,
      forma_pagamento = case when stripe_assinatura_id is null then 'pix' else forma_pagamento end,
      pago_ate = greatest(coalesce(pago_ate, now()), now()) + make_interval(days => ${DIAS_POR_PIX})
    where id = ${contaId}
  `;
}

/** cartão: o plano vale até o fim do período pago, mais a folga das novas tentativas */
async function liberarAssinatura(sub: Stripe.Subscription): Promise<void> {
  const contaId = sub.metadata?.conta_id;
  const plano = sub.metadata?.plano;
  if (!contaId || !ehPlanoPago(plano)) return;
  const fim = sub.items.data[0]?.current_period_end;
  if (!fim) return;
  const ate = new Date((fim + FOLGA_CARTAO_DIAS * 86400) * 1000);
  await db()`
    update contas set
      plano = case when plano = 'cortesia' then plano else ${plano} end,
      forma_pagamento = 'cartao',
      stripe_assinatura_id = ${sub.id},
      pago_ate = greatest(coalesce(pago_ate, now()), ${ate})
    where id = ${contaId}
  `;
}

/**
 * Trata um aviso da Stripe já conferido. Devolve false quando o mesmo aviso
 * já tinha sido processado (a Stripe reenvia em caso de dúvida).
 */
export async function tratarAviso(evento: Stripe.Event): Promise<boolean> {
  const sql = db();
  const novo = await sql`
    insert into eventos_pagamento (id, tipo, corpo)
    values (${evento.id}, ${evento.type}, ${JSON.stringify(evento.data.object)}::jsonb)
    on conflict (id) do nothing returning id
  `;
  if (!novo.length) return false;

  switch (evento.type) {
    // Pix pago na hora, ou a confirmação que chega depois (Pix pode ser assíncrono)
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = evento.data.object as Stripe.Checkout.Session;
      if (s.mode !== 'payment' || s.payment_status !== 'paid') break;
      const contaId = s.metadata?.conta_id;
      const plano = s.metadata?.plano;
      if (!contaId || !ehPlanoPago(plano)) break;
      // confere que o valor pago é o do plano: metadado sozinho não prova nada
      if ((s.amount_total ?? 0) < precoCentavos(plano)) break;
      await liberarPix(contaId, plano);
      await sql`update eventos_pagamento set conta_id = ${contaId} where id = ${evento.id}`;
      break;
    }
    // cartão: cada fatura paga (a primeira e as renovações) estende o plano
    case 'invoice.paid': {
      const fatura = evento.data.object as Stripe.Invoice;
      // contas com versão antiga da API mandam a assinatura direto na fatura
      const antiga = (fatura as unknown as { subscription?: string | { id: string } }).subscription;
      const ref = fatura.parent?.subscription_details?.subscription ?? antiga;
      const subId = typeof ref === 'string' ? ref : ref?.id;
      if (!subId) break;
      const sub = await stripe().subscriptions.retrieve(subId);
      await liberarAssinatura(sub);
      if (sub.metadata?.conta_id) await sql`update eventos_pagamento set conta_id = ${sub.metadata.conta_id} where id = ${evento.id}`;
      break;
    }
    // assinatura cancelada: o plano corre até o fim do que já foi pago e volta ao Free sozinho
    case 'customer.subscription.deleted': {
      const sub = evento.data.object as Stripe.Subscription;
      await sql`update contas set stripe_assinatura_id = null where stripe_assinatura_id = ${sub.id}`;
      break;
    }
  }
  return true;
}

/** como a conta paga hoje, para a página de planos mostrar o botão certo */
export async function situacaoDaCobranca(contaId: string): Promise<{ forma: Forma | null; temPortal: boolean; assinaturaAtiva: boolean }> {
  const r = await db()`select forma_pagamento, stripe_cliente_id, stripe_assinatura_id from contas where id = ${contaId}`;
  return {
    forma: (r[0]?.forma_pagamento as Forma) ?? null,
    temPortal: Boolean(r[0]?.stripe_cliente_id),
    assinaturaAtiva: Boolean(r[0]?.stripe_assinatura_id),
  };
}

