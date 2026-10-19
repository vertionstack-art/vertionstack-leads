import { NextResponse } from 'next/server';
import { paraAprimorar, marcarAprimorado, type Lead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { temperaturaDoLead } from '@/lib/temperatura';
import { acharCnpj, casaDosDadosConfigurada } from '@/lib/casa-dos-dados';
import { consultarCnpj } from '@/lib/cnpj';
import type { Plano } from '@/lib/planos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * "Aprimorar leads quentes": acha o CNPJ dos quentes na Casa dos Dados e
 * puxa os dados da Receita, para a temperatura deixar de ser só o que o
 * Google mostra.
 *
 * Só os quentes, de propósito. Cada lead gasta crédito pago da Casa dos
 * Dados, e o frio não vai ser abordado de qualquer jeito — o dinheiro vai
 * para confirmar (ou derrubar) quem você realmente vai chamar.
 *
 * Funciona em rodadas como o "Conferir sites": o painel chama até `faltam`
 * zerar, e cada chamada cabe no tempo da função.
 */
const POR_VEZ = 5;

/** leads aprimorados por semana em cada plano; a cortesia não tem teto */
const POR_SEMANA: Record<Plano, number> = { gratis: 5, semanal: 20, basic: 40, pro: 100, cortesia: 100000 };
const SEMANA = 7 * 24 * 60 * 60;

function quentes(leads: Lead[]): Lead[] {
  return leads.filter((l) => temperaturaDoLead(l).nivel === 'quente');
}

export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!casaDosDadosConfigurada()) return NextResponse.json({ ok: true, configurado: false, faltam: 0 });
  const faltam = quentes(await paraAprimorar(s.sessao.contaId)).length;
  return NextResponse.json({ ok: true, configurado: true, faltam, porSemana: POR_SEMANA[s.sessao.plano] });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const conta = s.sessao.contaId;

  if (!casaDosDadosConfigurada()) {
    return NextResponse.json({ ok: false, erro: 'O aprimoramento ainda não está ligado.' }, { status: 503 });
  }

  try {
    const fila = quentes(await paraAprimorar(conta));
    const lote = fila.slice(0, POR_VEZ);
    if (!lote.length) return NextResponse.json({ ok: true, feitos: 0, achados: 0, faltam: 0, resultados: [] });

    const teto = POR_SEMANA[s.sessao.plano];
    const resultados: { id: string; nome: string; resultado: string }[] = [];
    let semCota = false;
    let semSaldo = false;
    let falhas = 0;

    // um por vez: são poucos, e a Casa dos Dados cobra por pesquisa — rajada não ajuda ninguém
    for (const lead of lote) {
      if (!s.sessao.ilimitado && (await estourou('aprimorar:' + conta, teto, SEMANA))) {
        semCota = true;
        break;
      }

      const achado = await acharCnpj(lead);
      if (achado.status === 'sem_saldo') {
        semSaldo = true;
        break;
      }
      if (achado.status === 'erro') {
        // falha de rede não marca o lead: ele volta para a fila na próxima vez
        console.error('[aprimorar]', lead.id, achado.erro);
        falhas++;
        continue;
      }

      if (achado.status === 'achado') {
        const receita = await consultarCnpj(achado.cnpj);
        if (receita.ok) {
          await marcarAprimorado(conta, lead.id, 'achado', { ...receita.dados, achadoPor: achado.por });
          resultados.push({ id: lead.id, nome: lead.name, resultado: 'achado' });
          continue;
        }
        // achou o número mas a Receita não respondeu: tenta de novo depois
        falhas++;
        continue;
      }

      await marcarAprimorado(conta, lead.id, achado.status, null);
      resultados.push({ id: lead.id, nome: lead.name, resultado: achado.status });
    }

    if (semSaldo) {
      console.error('[aprimorar] Casa dos Dados sem saldo');
      return NextResponse.json(
        { ok: false, erro: 'O aprimoramento está pausado agora. Tente de novo mais tarde.' },
        { status: 503 },
      );
    }

    if (!resultados.length && falhas) {
      return NextResponse.json({ ok: false, erro: 'Não consegui consultar agora. Tente de novo em alguns minutos.' }, { status: 502 });
    }

    const faltam = Math.max(0, fila.length - resultados.length);
    return NextResponse.json({
      ok: true,
      feitos: resultados.length,
      achados: resultados.filter((r) => r.resultado === 'achado').length,
      faltam,
      semCota,
      ...(semCota && { aviso: `Você usou os ${teto} aprimoramentos desta semana do seu plano.` }),
      resultados,
    });
  } catch (err) {
    console.error('[aprimorar]', err);
    return NextResponse.json({ ok: false, erro: String((err as Error).message) }, { status: 500 });
  }
}
