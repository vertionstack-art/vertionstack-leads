/**
 * Onde a Stripe avisa que um pagamento caiu (webhook).
 *
 * O aviso só vale se a assinatura criptográfica bater com o segredo do
 * webhook: sem isso, qualquer um poderia mandar um "pagou" falso para cá e
 * liberar o Pro de graça.
 */

import { NextResponse } from 'next/server';
import { stripe, tratarAviso } from '@/lib/pagamento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  const assinatura = req.headers.get('stripe-signature');
  if (!segredo || !assinatura) return NextResponse.json({ ok: false }, { status: 400 });

  // o corpo cru, exatamente como chegou: a assinatura é calculada sobre ele
  const corpo = await req.text();

  let evento;
  try {
    evento = stripe().webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return NextResponse.json({ ok: false, erro: 'Assinatura do aviso não confere.' }, { status: 400 });
  }

  try {
    await tratarAviso(evento);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[aviso stripe]', evento.type, err);
    // 500 faz a Stripe tentar de novo mais tarde
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
