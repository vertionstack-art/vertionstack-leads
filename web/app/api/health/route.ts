import { NextResponse } from 'next/server';
import { coletorDaChave, cotaDaConta, cotaParaJson } from '@/lib/conta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A extensão bate aqui no "Testar conexão" e antes de começar uma coleta:
 * confere a chave, o computador, e devolve quanto da cota ainda sobra.
 */
export async function GET(req: Request) {
  const r = await coletorDaChave(req);
  if (!r.ok) return NextResponse.json({ ok: false, motivo: r.motivo, erro: r.erro }, { status: r.status });

  const cota = await cotaDaConta(r.coletor.contaId, r.coletor.plano);
  return NextResponse.json({
    ok: true,
    nome: r.coletor.nome,
    plano: r.coletor.plano,
    cota: cotaParaJson(cota),
  });
}
