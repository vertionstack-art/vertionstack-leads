import { NextResponse } from 'next/server';
import { rodarAvisosDoDia, rodarResumoSemanal } from '@/lib/avisos';
import { contaDaConversa } from '@/lib/conversa';
import { responderPendentes } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Os avisos de todo dia (plano vencendo, vencido, compra pela metade). A
 * Vercel chama este endereço pelo agendamento do vercel.json e manda o
 * CRON_SECRET no cabeçalho; sem ele, ninguém de fora dispara os e-mails.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const r = await rodarAvisosDoDia();
  // segunda-feira: o resumo da semana de cada conta
  const resumos = await rodarResumoSemanal();
  // 9h: o robô de vendas responde o que os clientes mandaram de madrugada
  let robo = 0;
  try {
    const conta = await contaDaConversa();
    if (conta) robo = await responderPendentes(conta, 8);
  } catch (e) {
    console.error('[cron] robo', e);
  }
  return NextResponse.json({ ok: true, ...r, resumos, robo });
}
