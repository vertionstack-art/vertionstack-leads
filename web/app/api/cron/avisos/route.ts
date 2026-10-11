import { NextResponse } from 'next/server';
import { rodarAvisosDoDia, rodarResumoSemanal } from '@/lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  return NextResponse.json({ ok: true, ...r, resumos });
}
