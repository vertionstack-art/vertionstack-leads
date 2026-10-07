/**
 * O CRM: funis, as etapas de cada funil e os leads andando por elas.
 *
 * Cada etapa aponta para um status do lead (contatado, negociando,
 * fechado...). Mover um card muda o status, e mudar o status no painel move o
 * card (lib/db, acompanharNoFunil). Assim o Financeiro, os filtros e o CRM
 * nunca discordam, e ninguém digita a mesma coisa em dois lugares.
 *
 * Como no resto da camada de dados, toda consulta filtra pela conta da
 * sessão: um id de etapa ou de funil de outra conta simplesmente não acha nada.
 */

import { db, json } from './sql';
import { daLinha, type Status } from './db';
import { temperaturaDoLead, type Nivel } from './temperatura';
import { valores, type CfgProposta } from './financeiro';

export type Cor = 'zinco' | 'ceu' | 'lavanda' | 'manteiga' | 'rosa' | 'menta';
export const CORES: Cor[] = ['zinco', 'ceu', 'lavanda', 'manteiga', 'rosa', 'menta'];
export const SITUACOES: Status[] = ['novo', 'contatado', 'negociando', 'fechado', 'descartado'];

export const MAX_ETAPAS = 12;
const MAX_CARDS = 1500;

export interface Etapa {
  id: string;
  nome: string;
  cor: Cor;
  situacao: Status;
  posicao: number;
}

export interface Funil {
  id: string;
  nome: string;
  etapas: Etapa[];
  cards: number;
}

export interface Card {
  id: string;
  nome: string;
  categoria: string | null;
  cidade: string | null;
  telefone: string | null;
  instagram: string | null;
  mapsUrl: string | null;
  notas: string | null;
  responsavel: string | null;
  temperatura: Nivel;
  etapaId: string;
  /** desde quando está nesta etapa */
  etapaEm: string;
  ordem: number;
  /** da proposta salva, em centavos; 0 quando não há proposta */
  entrada: number;
  mensalidade: number;
}

export interface Quadro {
  funis: Funil[];
  funilId: string;
  cards: Card[];
}

/** o funil que toda conta ganha: o caminho de quem vende site para comércio local */
const ETAPAS_PADRAO: Omit<Etapa, 'id' | 'posicao'>[] = [
  { nome: 'Para abordar', cor: 'zinco', situacao: 'novo' },
  { nome: 'Mensagem enviada', cor: 'ceu', situacao: 'contatado' },
  { nome: 'Conversando', cor: 'lavanda', situacao: 'negociando' },
  { nome: 'Proposta enviada', cor: 'manteiga', situacao: 'negociando' },
  { nome: 'Fechado', cor: 'menta', situacao: 'fechado' },
  { nome: 'Perdido', cor: 'rosa', situacao: 'descartado' },
];

type Sql = ReturnType<typeof db>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

async function criarEtapasPadrao(tx: Tx, conta: string, funilId: string) {
  for (const [i, e] of ETAPAS_PADRAO.entries()) {
    await tx`insert into etapas (conta_id, funil_id, nome, cor, situacao, posicao)
             values (${conta}, ${funilId}, ${e.nome}, ${e.cor}, ${e.situacao}, ${i})`;
  }
}

/**
 * Na primeira visita ao CRM a conta ganha o funil padrão, já com os leads que
 * estão em andamento (tudo que saiu de "novo") nas etapas certas. A trava
 * evita que duas abas abertas ao mesmo tempo criem dois funis.
 */
export async function garantirFunil(conta: string): Promise<void> {
  const sql = db();
  const [tem] = await sql`select 1 as x from funis where conta_id = ${conta} limit 1`;
  if (tem) return;
  await sql.begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${'funil:' + conta}))`;
    const [denovo] = await tx`select 1 as x from funis where conta_id = ${conta} limit 1`;
    if (denovo) return;
    const [f] = await tx`insert into funis (conta_id, nome, posicao) values (${conta}, 'Vendas de site', 0) returning id`;
    await criarEtapasPadrao(tx, conta, f.id);
    await tx`
      update leads l set etapa_id = e.id, etapa_em = l.updated_at, etapa_ordem = extract(epoch from l.updated_at)
      from (
        select distinct on (situacao) id, situacao from etapas
        where funil_id = ${f.id} order by situacao, posicao
      ) e
      where l.conta_id = ${conta} and l.status = e.situacao and l.status <> 'novo' and l.etapa_id is null
    `;
  });
}

async function listarFunis(sql: Sql, conta: string): Promise<Funil[]> {
  const [fs, es, ns] = await Promise.all([
    sql`select id, nome from funis where conta_id = ${conta} order by posicao, criado_em`,
    sql`select id, funil_id, nome, cor, situacao, posicao from etapas where conta_id = ${conta} order by posicao`,
    sql`select e.funil_id, count(*)::int as n from leads l join etapas e on e.id = l.etapa_id
        where l.conta_id = ${conta} group by e.funil_id`,
  ]);
  return fs.map((f) => ({
    id: f.id,
    nome: f.nome,
    cards: ns.find((n) => n.funil_id === f.id)?.n ?? 0,
    etapas: es
      .filter((e) => e.funil_id === f.id)
      .map((e) => ({ id: e.id, nome: e.nome, cor: e.cor, situacao: e.situacao, posicao: e.posicao })),
  }));
}

export async function quadro(conta: string, funilPedido?: string | null): Promise<Quadro> {
  await garantirFunil(conta);
  const sql = db();
  const funis = await listarFunis(sql, conta);
  const funil = funis.find((f) => f.id === funilPedido) || funis[0];
  const linhas = await sql`
    select l.* from leads l join etapas e on e.id = l.etapa_id
    where l.conta_id = ${conta} and e.funil_id = ${funil.id}
    order by l.etapa_ordem nulls last
    limit ${MAX_CARDS}
  `;
  const cards: Card[] = linhas.map((r) => {
    const lead = daLinha(r);
    const v = valores(json<CfgProposta>(r.proposta));
    return {
      id: lead.id,
      nome: lead.name,
      categoria: lead.category,
      cidade: lead.city,
      telefone: lead.phone,
      instagram: lead.instagram,
      mapsUrl: lead.mapsUrl,
      notas: lead.notes,
      responsavel: lead.responsavel,
      temperatura: temperaturaDoLead(lead).nivel,
      etapaId: r.etapa_id,
      etapaEm: new Date(r.etapa_em || r.updated_at).toISOString(),
      ordem: Number(r.etapa_ordem) || 0,
      entrada: v?.entrada ?? 0,
      mensalidade: v?.mensalidade ?? 0,
    };
  });
  return { funis, funilId: funil.id, cards };
}

/**
 * Põe o lead numa etapa (vindo de outra etapa, de outro funil ou de fora do
 * CRM). O status acompanha a etapa; ir para uma etapa de "fechado" marca a
 * proposta como fechada com a data de hoje, e sair dela desmarca — é isso que
 * o Financeiro lê para contar cliente e receita no mês certo.
 */
export async function moverCard(
  conta: string,
  leadIds: string[],
  etapaId: string,
  ordem: number | null,
  quem: string | null,
): Promise<number> {
  if (!leadIds.length) return 0;
  const sql = db();
  const [etapa] = await sql`select id, situacao from etapas where id = ${etapaId} and conta_id = ${conta}`;
  if (!etapa) return -1;
  const fechar = etapa.situacao === 'fechado';
  const r = await sql`
    update leads set
      etapa_em    = case when etapa_id is distinct from ${etapaId}::uuid then now() else etapa_em end,
      etapa_id    = ${etapaId}::uuid,
      etapa_ordem = coalesce(${ordem}::double precision, extract(epoch from now())),
      status      = ${etapa.situacao},
      responsavel = case when ${etapa.situacao} = 'novo' then null else coalesce(${quem}, responsavel) end,
      proposta    = case
        when proposta is null then null
        when ${fechar} and coalesce((proposta->>'fechado')::boolean, false) = false
          then proposta || jsonb_build_object('fechado', true, 'fechadoEm', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        when not ${fechar} and coalesce((proposta->>'fechado')::boolean, false)
          then proposta - 'fechado' - 'fechadoEm'
        else proposta end,
      updated_at  = now()
    where conta_id = ${conta} and id = any(${leadIds}::text[])
    returning id
  `;
  return r.length;
}

/** tira do CRM sem mexer no status nem apagar o lead */
export async function tirarDoFunil(conta: string, leadId: string): Promise<boolean> {
  const r = await db()`update leads set etapa_id = null, etapa_em = null, etapa_ordem = null
                       where conta_id = ${conta} and id = ${leadId} returning id`;
  return r.length > 0;
}

/** leads da conta que não estão neste funil, para o "adicionar ao funil" */
export async function candidatos(conta: string, funilId: string, busca: string) {
  const termo = '%' + busca.replace(/[%_\\]/g, '') + '%';
  const r = await db()`
    select l.id, l.name, l.category, l.city, l.status, f.nome as funil
    from leads l
    left join etapas e on e.id = l.etapa_id
    left join funis f on f.id = e.funil_id
    where l.conta_id = ${conta}
      and (e.funil_id is null or e.funil_id <> ${funilId})
      and l.status <> 'descartado'
      and (${busca === ''} or l.name ilike ${termo} or l.category ilike ${termo} or l.city ilike ${termo} or l.phone ilike ${termo})
    order by l.updated_at desc
    limit 40
  `;
  return r.map((x) => ({ id: x.id, nome: x.name, categoria: x.category, cidade: x.city, status: x.status, funil: x.funil }));
}

// ---------------------------------------------------------- funis

export async function criarFunil(conta: string, nome: string, teto: number): Promise<{ id: string } | { erro: string }> {
  const sql = db();
  return sql.begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${'funil:' + conta}))`;
    const [{ n }] = await tx`select count(*)::int as n from funis where conta_id = ${conta}`;
    if (n >= teto) {
      return { erro: teto === 1 ? 'O plano Free tem 1 funil. Assine o Basic para criar outros.' : `Seu plano permite até ${teto} funis.` };
    }
    const [f] = await tx`insert into funis (conta_id, nome, posicao) values (${conta}, ${nome}, ${n}) returning id`;
    await criarEtapasPadrao(tx, conta, f.id);
    return { id: f.id as string };
  });
}

export async function renomearFunil(conta: string, funilId: string, nome: string): Promise<boolean> {
  const r = await db()`update funis set nome = ${nome} where id = ${funilId} and conta_id = ${conta} returning id`;
  return r.length > 0;
}

/** apaga o funil; os leads saem do CRM mas continuam no painel, com o status que tinham */
export async function apagarFunil(conta: string, funilId: string): Promise<{ ok: true } | { erro: string }> {
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from funis where conta_id = ${conta}`;
  if (n <= 1) return { erro: 'Você precisa de pelo menos um funil.' };
  await sql`update leads set etapa_id = null, etapa_em = null, etapa_ordem = null
            where conta_id = ${conta} and etapa_id in (select id from etapas where funil_id = ${funilId} and conta_id = ${conta})`;
  const r = await sql`delete from funis where id = ${funilId} and conta_id = ${conta} returning id`;
  return r.length ? { ok: true } : { erro: 'Funil não encontrado.' };
}

// ---------------------------------------------------------- etapas

export interface EtapaEditada {
  id?: string;
  nome: string;
  cor: Cor;
  situacao: Status;
}

/**
 * Grava a lista inteira de etapas do funil, na ordem recebida. Etapa que sumiu
 * da lista é apagada; os cards dela vão para a etapa que ficava logo antes
 * (ou para a primeira, se era a primeira), para nenhum lead sumir do CRM nem
 * voltar para o começo do funil sem a pessoa perceber.
 */
export async function salvarEtapas(conta: string, funilId: string, lista: EtapaEditada[]): Promise<{ ok: true } | { erro: string }> {
  const sql = db();
  const [funil] = await sql`select id from funis where id = ${funilId} and conta_id = ${conta}`;
  if (!funil) return { erro: 'Funil não encontrado.' };
  return sql.begin(async (tx: Tx) => {
    const existentes: { id: string; posicao: number }[] = await tx`select id, posicao from etapas where funil_id = ${funilId} and conta_id = ${conta}`;
    const validos = new Set(existentes.map((e) => e.id));
    const mantidos: string[] = [];
    for (const [i, e] of lista.entries()) {
      if (e.id && validos.has(e.id)) {
        await tx`update etapas set nome = ${e.nome}, cor = ${e.cor}, situacao = ${e.situacao}, posicao = ${i}
                 where id = ${e.id} and conta_id = ${conta}`;
        mantidos.push(e.id);
      } else {
        const [nova] = await tx`insert into etapas (conta_id, funil_id, nome, cor, situacao, posicao)
                                values (${conta}, ${funilId}, ${e.nome}, ${e.cor}, ${e.situacao}, ${i}) returning id`;
        mantidos.push(nova.id);
      }
    }
    const saem = [...validos].filter((id) => !mantidos.includes(id));
    if (saem.length) {
      const posAntiga = new Map(existentes.map((e) => [e.id, e.posicao]));
      const ficam = mantidos.filter((id) => posAntiga.has(id));
      for (const id of saem) {
        const antes = ficam.filter((k) => posAntiga.get(k)! < posAntiga.get(id)!);
        const destino = antes.length ? antes.reduce((a, b) => (posAntiga.get(a)! > posAntiga.get(b)! ? a : b)) : mantidos[0];
        const [d] = await tx`select situacao from etapas where id = ${destino}`;
        await tx`update leads set etapa_id = ${destino}, etapa_em = now(), status = ${d.situacao}
                 where conta_id = ${conta} and etapa_id = ${id}`;
      }
      await tx`delete from etapas where id = any(${saem}::uuid[]) and conta_id = ${conta}`;
    }
    // o status dos cards acompanha a etapa, caso a situação dela tenha mudado
    await tx`update leads l set status = e.situacao from etapas e
             where l.etapa_id = e.id and e.funil_id = ${funilId} and l.conta_id = ${conta} and l.status <> e.situacao`;
    return { ok: true as const };
  });
}

// ---------------------------------------------------------- validação

export function textoCurto(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validarEtapas(cru: unknown): EtapaEditada[] | string {
  if (!Array.isArray(cru)) return 'Lista de etapas inválida.';
  if (cru.length < 2) return 'O funil precisa de pelo menos 2 etapas.';
  if (cru.length > MAX_ETAPAS) return `No máximo ${MAX_ETAPAS} etapas por funil.`;
  const lista: EtapaEditada[] = [];
  for (const x of cru as Record<string, unknown>[]) {
    const nome = textoCurto(x?.nome, 30);
    if (!nome) return 'Toda etapa precisa de um nome.';
    const cor = CORES.includes(x?.cor as Cor) ? (x.cor as Cor) : 'zinco';
    const situacao = SITUACOES.includes(x?.situacao as Status) ? (x.situacao as Status) : 'negociando';
    const id = typeof x?.id === 'string' && /^[0-9a-f-]{36}$/i.test(x.id) ? x.id : undefined;
    lista.push({ id, nome, cor, situacao });
  }
  return lista;
}

export function uuidValido(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
