import { NextResponse } from 'next/server';
import { paraVerificar, faltamVerificar, marcarVerificacao } from '@/lib/db';
import { verificarSite } from '@/lib/verificar-site';
import { estaLogado } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Verifica um punhado de sites por chamada, não todos de uma vez.
 *
 * Cada verificação é uma requisição a um servidor de terceiro que pode
 * demorar até nove segundos, e a função tem tempo limitado. Então o painel
 * chama esta rota repetidamente até `faltam` chegar a zero — assim uma
 * lista de mil leads é processada sem nunca estourar o tempo.
 */
const POR_VEZ = 10;

export async function GET() {
  if (!(await estaLogado())) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, faltam: await faltamVerificar() });
}

export async function POST() {
  if (!(await estaLogado())) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const lote = await paraVerificar(POR_VEZ);

    if (!lote.length) {
      return NextResponse.json({ ok: true, verificados: 0, faltam: 0, resultados: [] });
    }

    // em paralelo: são esperas de rede, não trabalho de processador
    const resultados = await Promise.all(
      lote.map(async (lead) => {
        try {
          const v = await verificarSite(lead.website);
          if (!v) return null;
          await marcarVerificacao(lead.id, {
            status: v.status,
            detalhe: v.detalhe,
            viraLead: v.viraLead,
          });
          return { id: lead.id, nome: lead.name, status: v.status, viraLead: v.viraLead };
        } catch (err) {
          // um site problemático não pode derrubar o lote inteiro
          await marcarVerificacao(lead.id, {
            status: 'bloqueado',
            detalhe: 'Não consegui checar: ' + String((err as Error).message).slice(0, 120),
            viraLead: false,
          }).catch(() => {});
          return { id: lead.id, nome: lead.name, status: 'bloqueado', viraLead: false };
        }
      }),
    );

    const feitos = resultados.filter(Boolean);

    return NextResponse.json({
      ok: true,
      verificados: feitos.length,
      faltam: await faltamVerificar(),
      novasOportunidades: feitos.filter((r) => r && r.viraLead).length,
      resultados: feitos,
    });
  } catch (err) {
    console.error('[verificar]', err);
    return NextResponse.json({ ok: false, erro: String((err as Error).message) }, { status: 500 });
  }
}
