import { NextResponse } from 'next/server';
import {
  listarLeads,
  salvarLeads,
  normalizarLead,
  apagarTudo,
  temBanco,
  type Filtros,
  type Status,
} from '@/lib/db';
import type { WebsiteKind } from '@/lib/classify';
import { quemEnviou, podeLer, estaLogado, usuarioAtual, nomesDaEquipe } from '@/lib/auth';
import { caminhoDaProposta } from '@/lib/token-proposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS: WebsiteKind[] = ['none', 'social', 'marketplace', 'weak', 'site'];
const STATUS: Status[] = ['novo', 'contatado', 'negociando', 'fechado', 'descartado'];

function lista<T extends string>(param: string | null, validos: readonly T[]): T[] | undefined {
  if (!param) return undefined;
  const itens = param.split(',').map((s) => s.trim()).filter((s): s is T => (validos as readonly string[]).includes(s));
  return itens.length ? itens : undefined;
}

export function filtrosDaUrl(url: URL): Filtros {
  return {
    busca: url.searchParams.get('q') || undefined,
    kinds: lista(url.searchParams.get('kind'), KINDS),
    status: lista(url.searchParams.get('status'), STATUS),
    city: url.searchParams.get('city') || undefined,
    category: url.searchParams.get('category') || undefined,
    somenteLeads: url.searchParams.get('leads') === '1',
    comTelefone: url.searchParams.get('fone') === '1',
    siteQuebrado: url.searchParams.get('quebrado') === '1',
    responsavel: url.searchParams.get('de') || undefined,
    limit: Number(url.searchParams.get('limit')) || 200,
    offset: Number(url.searchParams.get('offset')) || 0,
    ordem: (url.searchParams.get('ordem') as Filtros['ordem']) || 'recentes',
  };
}

// ------------------------------------------------- recebe da extensão

export async function POST(req: Request) {
  /*
   * Duas portas para o mesmo lugar: a extensão chega com a chave, e quem
   * está no painel chega com a sessão do navegador — este segundo caso é o
   * cadastro feito à mão, de um comércio que veio por indicação ou que
   * você conheceu na rua, e que nunca passaria por uma varredura do Maps.
   */
  const porChave = quemEnviou(req);
  const porSessao = porChave ? null : await usuarioAtual();
  const coletor = porChave || porSessao;
  const manual = !porChave && Boolean(porSessao);

  if (!coletor) {
    return NextResponse.json(
      { ok: false, erro: 'Chave inválida. Confira o INGEST_TOKEN na Vercel e a chave nas configurações da extensão.' },
      { status: 401 },
    );
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
  if (brutos.length > 1000) {
    return NextResponse.json({ ok: false, erro: 'Lote grande demais (máximo 1000 por vez).' }, { status: 413 });
  }

  const limpos = brutos
    .map((b) => normalizarLead(b as Record<string, unknown>, coletor, manual ? 'manual' : 'maps'))
    .filter((l): l is NonNullable<typeof l> => l !== null);

  // dentro do mesmo lote pode vir o mesmo comércio duas vezes
  const unicos = Array.from(new Map(limpos.map((l) => [l.id, l])).values());

  try {
    const r = await salvarLeads(unicos);
    return NextResponse.json({
      ok: true,
      ...r,
      ignorados: brutos.length - unicos.length,
      persistido: temBanco,
      coletor,
    });
  } catch (err) {
    console.error('[leads POST]', err);
    return NextResponse.json(
      { ok: false, erro: 'Falha ao gravar no banco: ' + String((err as Error).message) },
      { status: 500 },
    );
  }
}

// -------------------------------------------------------- lê no painel

export async function GET(req: Request) {
  if (!(await podeLer(req))) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const pagina = await listarLeads(filtrosDaUrl(new URL(req.url)));
    return NextResponse.json({
      ok: true,
      ...pagina,
      leads: pagina.leads.map((l) => ({ ...l, linkProposta: caminhoDaProposta(l.id) })),
      persistido: temBanco,
      equipe: nomesDaEquipe,
    });
  } catch (err) {
    console.error('[leads GET]', err);
    return NextResponse.json({ ok: false, erro: String((err as Error).message) }, { status: 500 });
  }
}

// ------------------------------------------------------------- limpar

export async function DELETE() {
  if (!(await estaLogado())) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  const n = await apagarTudo();
  return NextResponse.json({ ok: true, apagados: n });
}
