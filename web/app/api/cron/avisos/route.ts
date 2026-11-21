import { NextResponse } from 'next/server';
import { rodarResumoSemanal } from '@/lib/avisos';
import { contaDaConversa } from '@/lib/conversa';
import { responderPendentes } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * O aviso das 9h. Quem chama é o tarefas-do-dia.ps1 do PC (C:\Users\lucas\vertion-banco),
 * com o CRON_SECRET no cabeçalho; sem ele, ninguém de fora dispara nada.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
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
  return NextResponse.json({ ok: true, resumos, robo });
}
