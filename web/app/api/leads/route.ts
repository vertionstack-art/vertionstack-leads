import { NextResponse } from 'next/server';
import {
  listarLeads,
  salvarLeads,
  normalizarLead,
  apagarPorFiltro,
  idsNovos,
  type Filtros,
  type Status,
} from '@/lib/db';
import type { WebsiteKind } from '@/lib/classify';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { coletorDaChave, cotaDaConta, cotaParaJson, devolverCota, equipeDaConta, reservarCota, type Plano } from '@/lib/conta';
import { estourou } from '@/lib/limite';
import { caminhoDaProposta } from '@/lib/token-proposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS: WebsiteKind[] = ['none', 'social', 'marketplace', 'weak', 'site'];
const STATUS: Status[] = ['novo', 'contatado', 'negociando', 'fechado', 'descartado'];
const NIVEIS = ['quente', 'morno', 'frio'] as const;
const ORDENS = ['recentes', 'nome', 'avaliacoes', 'temperatura'] as const;

function lista<T extends string>(param: string | null, validos: readonly T[]): T[] | undefined {
  if (!param) return undefined;
  const itens = param.split(',').map((s) => s.trim()).filter((s): s is T => (validos as readonly string[]).includes(s));
  return itens.length ? itens : undefined;
}

function texto(v: string | null, max = 120): string | undefined {
  return v ? v.slice(0, max) : undefined;
}

export function filtrosDaUrl(url: URL): Filtros {
  const ordem = url.searchParams.get('ordem');
  return {
    busca: texto(url.searchParams.get('q')),
    kinds: lista(url.searchParams.get('kind'), KINDS),
    status: lista(url.searchParams.get('status'), STATUS),
    city: texto(url.searchParams.get('city')),
    category: texto(url.searchParams.get('category')),
    somenteLeads: url.searchParams.get('leads') === '1',
    comTelefone: url.searchParams.get('fone') === '1',
    siteQuebrado: url.searchParams.get('quebrado') === '1',
    responsavel: texto(url.searchParams.get('de'), 60),
    temperatura: lista(url.searchParams.get('temp'), NIVEIS),
    limit: Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 2000),
    offset: Math.max(Number(url.searchParams.get('offset')) || 0, 0),
    ordem: (ORDENS as readonly string[]).includes(ordem || '') ? (ordem as Filtros['ordem']) : 'recentes',
  };
}

// ------------------------------------------------- recebe da extensão

export async function POST(req: Request) {
  /*
   * Duas portas para o mesmo lugar: a extensão chega com a chave, e quem
   * está no painel chega com a sessão do navegador — este segundo caso é o
   * cadastro feito à mão, de um comércio que veio por indicação.
   *
   * As duas gastam a mesma cota semanal: senão o plano grátis teria uma
   * porta sem limite.
   */
  let contaId: string;
  let coletor: string;
  let ilimitado: boolean;
  let plano: Plano;
  let manual = false;

  if (req.headers.get('x-api-key')) {
    const r = await coletorDaChave(req);
    if (!r.ok) return NextResponse.json({ ok: false, motivo: r.motivo, erro: r.erro }, { status: r.status });
    ({ contaId, nome: coletor, ilimitado, plano } = r.coletor);
    // a extensão manda em lotes; 60 lotes por minuto por conta é muito acima do uso normal
    if (await estourou(`ingest:${contaId}`, 60, 60)) {
      return NextResponse.json({ ok: false, erro: 'Envios demais em pouco tempo. Espere um minuto.' }, { status: 429 });
    }
  } else {
    if (!origemConfere(req)) return recusarOrigem();
    const s = await exigirSessao();
    if (s.erro) return s.erro;
    ({ contaId, nome: coletor, ilimitado, plano } = s.sessao);
    manual = true;
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'Corpo da requisição não é JSON válido.' }, { status: 400 });
  }

  const brutos = (corpo as { leads?: unknown })?.leads;
  if (!Array.isArray(brutos)) {
    return NextResponse.json({ ok: false, erro: 'Esperava um campo "leads" com uma lista.' }, { status: 400 });
  }
  if (brutos.length > 500) {
    return NextResponse.json({ ok: false, erro: 'Lote grande demais (máximo 500 por vez).' }, { status: 413 });
  }

  const limpos = brutos
    .map((b) => normalizarLead((b || {}) as Record<string, unknown>, coletor, manual ? 'manual' : 'maps'))
    .filter((l): l is NonNullable<typeof l> => l !== null);

  // dentro do mesmo lote pode vir o mesmo comércio duas vezes
  const unicos = Array.from(new Map(limpos.map((l) => [l.id, l])).values());

  try {
    const novos = await idsNovos(contaId, unicos.map((l) => l.id));
    const concedidos = await reservarCota(contaId, novos.length, plano);
    const r = await salvarLeads(contaId, unicos, concedidos);
    // reservou mais do que gravou (outro envio gravou o mesmo comércio no meio)
    if (!ilimitado) await devolverCota(contaId, concedidos - r.novos, plano);
    const cota = await cotaDaConta(contaId, plano);

    const estourouCota = r.barradosPelaCota > 0;
    return NextResponse.json(
      {
        ok: !estourouCota || r.novos + r.atualizados > 0,
        ...r,
        ignorados: brutos.length - unicos.length,
        coletor,
        cota: cotaParaJson(cota),
        motivo: estourouCota ? 'cota' : undefined,
        erro: estourouCota
          ? cota.guardados >= cota.tetoGuardados
            ? `Sua conta chegou ao limite de ${cota.tetoGuardados} leads guardados do plano. Apague os que não servem ou mude de plano.`
            : cota.testeNegado
              ? `O teste grátis já foi usado em outra conta ${cota.testeNegado} (limite de 1 teste por pessoa). Assine um plano para coletar leads.`
              : cota.teste
                ? `Seu teste grátis acabou (limite de ${cota.limite} leads). Assine um plano para continuar coletando.`
                : `Limite do seu plano: ${cota.limite} leads novos por semana. Veja os planos para coletar mais.`
          : undefined,
      },
      { status: estourouCota && r.novos + r.atualizados === 0 ? 402 : 200 },
    );
  } catch (err) {
    console.error('[leads POST]', err);
    return NextResponse.json({ ok: false, erro: 'Falha ao gravar. Tente de novo.' }, { status: 500 });
  }
}

// -------------------------------------------------------- lê no painel

export async function GET(req: Request) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, plano } = s.sessao;

  try {
    const [pagina, equipe, cota] = await Promise.all([
      listarLeads(contaId, filtrosDaUrl(new URL(req.url))),
      equipeDaConta(contaId),
      cotaDaConta(contaId, plano),
    ]);
    return NextResponse.json({
      ok: true,
      ...pagina,
      leads: pagina.leads.map((l) => ({ ...l, linkProposta: caminhoDaProposta(contaId, l.id) })),
      equipe,
      cota: cotaParaJson(cota),
    });
  } catch (err) {
    console.error('[leads GET]', err);
    return NextResponse.json({ ok: false, erro: 'Não consegui carregar os leads.' }, { status: 500 });
  }
}

// ------------------------------------------------------------- limpar

/**
 * Apaga os leads que os filtros da URL selecionam. Sem filtro, apaga tudo
 * — da conta de quem pediu, nunca de outra.
 *
 * Pede a contagem esperada no corpo e recusa quando ela não bate com o que
 * a consulta encontrou: a tela mostra "excluir os 12 da lista", e se a
 * lista mudou entre ver o número e confirmar, a operação para.
 */
export async function DELETE(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId } = s.sessao;

  const corpo = (await req.json().catch(() => ({}))) as { esperado?: number };
  if (typeof corpo.esperado !== 'number' || corpo.esperado < 0) {
    return NextResponse.json({ ok: false, erro: 'Informe quantos leads você espera apagar.' }, { status: 400 });
  }

  const filtros = filtrosDaUrl(new URL(req.url));
  const pagina = await listarLeads(contaId, { ...filtros, limit: 1, offset: 0 });

  if (pagina.total !== corpo.esperado) {
    return NextResponse.json(
      { ok: false, erro: `A lista mudou: agora são ${pagina.total} leads, não ${corpo.esperado}. Confira e tente de novo.` },
      { status: 409 },
    );
  }

  const apagados = await apagarPorFiltro(contaId, filtros);
  return NextResponse.json({ ok: true, apagados });
}

