import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { mudarLimites, usoDaIa } from '@/lib/ia';
import { podeUsarConversa } from '@/lib/conversa-contexto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** o medidor da IA: quanto foi gasto hoje e no mês, e os limites */
export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, uso: await usoDaIa(s.sessao.contaId) });
}

/** muda os limites, em dólar: { diaUsd, mesUsd } */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  if (await estourou('ia-limite:' + s.sessao.userId, 20, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Espere um minuto.' }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { diaUsd?: number; mesUsd?: number };
  const dia = Math.round(Number(corpo.diaUsd) * 100) / 100;
  const mes = Math.round(Number(corpo.mesUsd) * 100) / 100;
  if (!(dia > 0 && dia <= 100) || !(mes > 0 && mes <= 1000)) {
    return NextResponse.json({ ok: false, erro: 'Use um limite entre US$ 0,01 e US$ 100 por dia e até US$ 1.000 por mês.' }, { status: 400 });
  }
  if (dia > mes) return NextResponse.json({ ok: false, erro: 'O limite do dia não pode passar o do mês.' }, { status: 400 });
  await mudarLimites(s.sessao.contaId, dia, mes);
  return NextResponse.json({ ok: true, uso: await usoDaIa(s.sessao.contaId) });
}
