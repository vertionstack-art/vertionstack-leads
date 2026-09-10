/**
 * Camada de dados.
 *
 * Em produção usa Postgres (Neon, que é o banco que a Vercel oferece
 * de graça). Sem DATABASE_URL, cai para um armazenamento em memória:
 * serve para rodar na sua máquina e testar a extensão antes de criar
 * o banco — mas na Vercel esse modo perde tudo entre uma visita e outra,
 * porque cada requisição pode cair num servidor diferente.
 */

import { neon } from '@neondatabase/serverless';
import { classifyWebsite, type WebsiteKind } from './classify';

const URL_BANCO =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  '';

export const temBanco = Boolean(URL_BANCO);

const sql = temBanco ? neon(URL_BANCO) : null;

export type Status = 'novo' | 'contatado' | 'negociando' | 'fechado' | 'descartado';

export interface Lead {
  id: string;
  name: string;
  category: string | null;
  searchTerm: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  websiteKind: WebsiteKind;
  websiteLabel: string | null;
  isLead: boolean;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  hours: string | null;
  status: Status;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Filtros {
  busca?: string;
  kinds?: WebsiteKind[];
  status?: Status[];
  city?: string;
  category?: string;
  somenteLeads?: boolean;
  comTelefone?: boolean;
  limit?: number;
  offset?: number;
  ordem?: 'recentes' | 'nome' | 'avaliacoes';
}

// ------------------------------------------------------------ schema

let schemaPronto = false;

export async function garantirSchema() {
  if (!sql || schemaPronto) return;

  await sql`
    create table if not exists leads (
      id            text primary key,
      name          text not null,
      category      text,
      search_term   text,
      city          text,
      phone         text,
      address       text,
      website       text,
      website_kind  text not null default 'none',
      website_label text,
      is_lead       boolean not null default true,
      rating        real,
      reviews       integer,
      maps_url      text,
      lat           double precision,
      lng           double precision,
      hours         text,
      status        text not null default 'novo',
      notes         text,
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now()
    )
  `;
  await sql`create index if not exists leads_kind_idx on leads (website_kind)`;
  await sql`create index if not exists leads_status_idx on leads (status)`;
  await sql`create index if not exists leads_city_idx on leads (city)`;
  await sql`create index if not exists leads_created_idx on leads (created_at desc)`;

  schemaPronto = true;
}

// --------------------------------------------------- modo sem banco

type Memoria = Map<string, Lead>;

const globalRef = globalThis as unknown as { __vlMemoria?: Memoria };
const memoria: Memoria = globalRef.__vlMemoria || (globalRef.__vlMemoria = new Map());

// ------------------------------------------------------------ util

function normalizarId(bruto: string): string {
  return bruto.trim().toLowerCase().slice(0, 300);
}

/** limpa e reclassifica o que chegou da extensão — nunca confiar no cliente */
export function normalizarLead(cru: Record<string, unknown>): Lead | null {
  const nome = String(cru.name || '').trim();
  if (!nome) return null;

  const chave = String(cru.placeKey || cru.id || `${nome}|${cru.address || ''}`);
  const veredito = classifyWebsite(typeof cru.website === 'string' ? cru.website : null);
  const agora = new Date().toISOString();

  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const texto = (v: unknown, max = 500): string | null => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s ? s.slice(0, max) : null;
  };

  return {
    id: normalizarId(chave),
    name: nome.slice(0, 250),
    category: texto(cru.category, 120),
    searchTerm: texto(cru.searchTerm, 120),
    city: texto(cru.city, 120),
    phone: texto(cru.phone, 40),
    address: texto(cru.address, 300),
    website: veredito.url,
    websiteKind: veredito.kind,
    websiteLabel: veredito.label,
    isLead: veredito.isLead,
    rating: num(cru.rating),
    reviews: num(cru.reviews),
    mapsUrl: texto(cru.mapsUrl, 900),
    lat: num(cru.lat),
    lng: num(cru.lng),
    hours: texto(cru.hours, 200),
    status: 'novo',
    notes: null,
    createdAt: agora,
    updatedAt: agora,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function daLinha(r: any): Lead {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    searchTerm: r.search_term,
    city: r.city,
    phone: r.phone,
    address: r.address,
    website: r.website,
    websiteKind: r.website_kind,
    websiteLabel: r.website_label,
    isLead: r.is_lead,
    rating: r.rating,
    reviews: r.reviews,
    mapsUrl: r.maps_url,
    lat: r.lat,
    lng: r.lng,
    hours: r.hours,
    status: r.status,
    notes: r.notes,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------- escrita

export interface ResultadoGravacao {
  recebidos: number;
  novos: number;
  atualizados: number;
}

/**
 * Grava o lote. Um comércio já conhecido tem os dados do Maps atualizados,
 * mas o status e as anotações que você escreveu ficam intactos — senão uma
 * nova varredura apagaria seu trabalho de prospecção.
 */
export async function salvarLeads(leads: Lead[]): Promise<ResultadoGravacao> {
  if (!leads.length) return { recebidos: 0, novos: 0, atualizados: 0 };

  if (!sql) {
    let novos = 0;
    let atualizados = 0;
    for (const l of leads) {
      const antigo = memoria.get(l.id);
      if (antigo) {
        memoria.set(l.id, { ...l, status: antigo.status, notes: antigo.notes, createdAt: antigo.createdAt });
        atualizados++;
      } else {
        memoria.set(l.id, l);
        novos++;
      }
    }
    return { recebidos: leads.length, novos, atualizados };
  }

  await garantirSchema();

  const jaExistiam = new Set<string>();
  const ids = leads.map((l) => l.id);
  const existentes = await sql`select id from leads where id = any(${ids})`;
  for (const r of existentes as { id: string }[]) jaExistiam.add(r.id);

  for (const l of leads) {
    await sql`
      insert into leads (
        id, name, category, search_term, city, phone, address, website,
        website_kind, website_label, is_lead, rating, reviews, maps_url,
        lat, lng, hours, status, updated_at
      ) values (
        ${l.id}, ${l.name}, ${l.category}, ${l.searchTerm}, ${l.city}, ${l.phone},
        ${l.address}, ${l.website}, ${l.websiteKind}, ${l.websiteLabel}, ${l.isLead},
        ${l.rating}, ${l.reviews}, ${l.mapsUrl}, ${l.lat}, ${l.lng}, ${l.hours},
        'novo', now()
      )
      on conflict (id) do update set
        name          = excluded.name,
        category      = coalesce(excluded.category, leads.category),
        search_term   = coalesce(excluded.search_term, leads.search_term),
        city          = coalesce(excluded.city, leads.city),
        phone         = coalesce(excluded.phone, leads.phone),
        address       = coalesce(excluded.address, leads.address),
        website       = excluded.website,
        website_kind  = excluded.website_kind,
        website_label = excluded.website_label,
        is_lead       = excluded.is_lead,
        rating        = coalesce(excluded.rating, leads.rating),
        reviews       = coalesce(excluded.reviews, leads.reviews),
        maps_url      = coalesce(excluded.maps_url, leads.maps_url),
        lat           = coalesce(excluded.lat, leads.lat),
        lng           = coalesce(excluded.lng, leads.lng),
        hours         = coalesce(excluded.hours, leads.hours),
        updated_at    = now()
    `;
  }

  const atualizados = jaExistiam.size;
  return { recebidos: leads.length, novos: leads.length - atualizados, atualizados };
}

export async function atualizarLead(
  id: string,
  patch: { status?: Status; notes?: string | null },
): Promise<Lead | null> {
  if (!sql) {
    const atual = memoria.get(id);
    if (!atual) return null;
    const novo = { ...atual, ...patch, updatedAt: new Date().toISOString() };
    memoria.set(id, novo);
    return novo;
  }

  await garantirSchema();
  const linhas = await sql`
    update leads set
      status     = coalesce(${patch.status ?? null}, status),
      notes      = case when ${patch.notes !== undefined} then ${patch.notes ?? null} else notes end,
      updated_at = now()
    where id = ${id}
    returning *
  `;
  return linhas.length ? daLinha(linhas[0]) : null;
}

export async function apagarLead(id: string): Promise<boolean> {
  if (!sql) return memoria.delete(id);
  await garantirSchema();
  const r = await sql`delete from leads where id = ${id} returning id`;
  return r.length > 0;
}

export async function apagarTudo(): Promise<number> {
  if (!sql) {
    const n = memoria.size;
    memoria.clear();
    return n;
  }
  await garantirSchema();
  const r = await sql`delete from leads returning id`;
  return r.length;
}

// ---------------------------------------------------------- leitura

function filtrarEmMemoria(todos: Lead[], f: Filtros): Lead[] {
  let out = todos;
  if (f.kinds?.length) out = out.filter((l) => f.kinds!.includes(l.websiteKind));
  if (f.status?.length) out = out.filter((l) => f.status!.includes(l.status));
  if (f.somenteLeads) out = out.filter((l) => l.isLead);
  if (f.comTelefone) out = out.filter((l) => !!l.phone);
  if (f.city) out = out.filter((l) => (l.city || '').toLowerCase().includes(f.city!.toLowerCase()));
  if (f.category) out = out.filter((l) => (l.category || '').toLowerCase().includes(f.category!.toLowerCase()));
  if (f.busca) {
    const q = f.busca.toLowerCase();
    out = out.filter((l) =>
      [l.name, l.category, l.address, l.phone, l.city].some((c) => (c || '').toLowerCase().includes(q)),
    );
  }
  const ordem = f.ordem || 'recentes';
  out = [...out].sort((a, b) => {
    if (ordem === 'nome') return a.name.localeCompare(b.name, 'pt-BR');
    if (ordem === 'avaliacoes') return (b.reviews || 0) - (a.reviews || 0);
    return b.createdAt.localeCompare(a.createdAt);
  });
  return out;
}

export interface PaginaDeLeads {
  leads: Lead[];
  total: number;
  resumo: Record<string, number>;
  cidades: string[];
  categorias: string[];
}

export async function listarLeads(f: Filtros): Promise<PaginaDeLeads> {
  const limit = Math.min(f.limit ?? 200, 2000);
  const offset = f.offset ?? 0;

  if (!sql) {
    const todos = Array.from(memoria.values());
    const filtrados = filtrarEmMemoria(todos, f);
    return {
      leads: filtrados.slice(offset, offset + limit),
      total: filtrados.length,
      resumo: resumoDe(todos),
      cidades: unicos(todos.map((l) => l.city)),
      categorias: unicos(todos.map((l) => l.category)),
    };
  }

  await garantirSchema();

  // O driver do Neon monta a query parametrizada; para filtros opcionais
  // usamos o truque do "parâmetro nulo desliga a condição".
  const kinds = f.kinds?.length ? f.kinds : null;
  const statusList = f.status?.length ? f.status : null;
  const busca = f.busca ? `%${f.busca}%` : null;
  const city = f.city ? `%${f.city}%` : null;
  const category = f.category ? `%${f.category}%` : null;
  const ordem = f.ordem || 'recentes';

  const linhas = await sql`
    select * from leads
    where (${kinds}::text[] is null or website_kind = any(${kinds}::text[]))
      and (${statusList}::text[] is null or status = any(${statusList}::text[]))
      and (${f.somenteLeads ? true : null}::boolean is null or is_lead = true)
      and (${f.comTelefone ? true : null}::boolean is null or (phone is not null and phone <> ''))
      and (${city}::text is null or city ilike ${city})
      and (${category}::text is null or category ilike ${category})
      and (${busca}::text is null or name ilike ${busca} or address ilike ${busca}
           or phone ilike ${busca} or category ilike ${busca} or city ilike ${busca})
    order by
      case when ${ordem} = 'nome' then name end asc,
      case when ${ordem} = 'avaliacoes' then reviews end desc nulls last,
      case when ${ordem} = 'recentes' then created_at end desc
    limit ${limit} offset ${offset}
  `;

  const totalRow = await sql`
    select count(*)::int as n from leads
    where (${kinds}::text[] is null or website_kind = any(${kinds}::text[]))
      and (${statusList}::text[] is null or status = any(${statusList}::text[]))
      and (${f.somenteLeads ? true : null}::boolean is null or is_lead = true)
      and (${f.comTelefone ? true : null}::boolean is null or (phone is not null and phone <> ''))
      and (${city}::text is null or city ilike ${city})
      and (${category}::text is null or category ilike ${category})
      and (${busca}::text is null or name ilike ${busca} or address ilike ${busca}
           or phone ilike ${busca} or category ilike ${busca} or city ilike ${busca})
  `;

  const porTipo = await sql`select website_kind, count(*)::int as n from leads group by website_kind`;
  const porStatus = await sql`select status, count(*)::int as n from leads group by status`;
  const cidades = await sql`select distinct city from leads where city is not null order by city limit 200`;
  const categorias = await sql`select distinct category from leads where category is not null order by category limit 300`;

  const resumo: Record<string, number> = { total: 0 };
  for (const r of porTipo as { website_kind: string; n: number }[]) {
    resumo[r.website_kind] = r.n;
    resumo.total += r.n;
  }
  for (const r of porStatus as { status: string; n: number }[]) resumo['status_' + r.status] = r.n;

  return {
    leads: (linhas as any[]).map(daLinha),
    total: (totalRow[0] as { n: number }).n,
    resumo,
    cidades: (cidades as { city: string }[]).map((r) => r.city),
    categorias: (categorias as { category: string }[]).map((r) => r.category),
  };
}

function unicos(vals: (string | null)[]): string[] {
  return Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function resumoDe(todos: Lead[]): Record<string, number> {
  const r: Record<string, number> = { total: todos.length };
  for (const l of todos) {
    r[l.websiteKind] = (r[l.websiteKind] || 0) + 1;
    r['status_' + l.status] = (r['status_' + l.status] || 0) + 1;
  }
  return r;
}

export async function todosOsLeads(f: Filtros): Promise<Lead[]> {
  const p = await listarLeads({ ...f, limit: 2000, offset: 0 });
  return p.leads;
}
