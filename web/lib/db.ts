/**
 * Camada de dados dos leads.
 *
 * Toda função recebe a conta como primeiro argumento e toda consulta filtra
 * por ela. Não existe caminho que leia ou grave lead sem conta: é isso que
 * impede alguém de ver o lead de outra pessoa trocando o id na URL — o id
 * sozinho não acha nada fora da própria conta.
 *
 * A conta vem sempre da sessão (ou da chave da extensão) resolvida no
 * servidor, nunca de algo que o navegador mande.
 */

import { classifyWebsite, type WebsiteKind } from './classify';
import type { SiteStatus } from './verificar-site';
import { temperaturaDoLead, type Nivel } from './temperatura';
import { db, json, temBanco } from './sql';
import { numeroWhatsapp, tipoDoTelefone, type TipoTelefone } from './telefone';
import { registrarEvento, rotuloDoStatus } from './eventos';
import { emailValido } from './email-lead';

export { temBanco };

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
  /** resultado da verificação do site; null enquanto ninguém verificou */
  siteStatus: SiteStatus | null;
  siteDetalhe: string | null;
  siteVerificadoEm: string | null;
  /** quem rodou a extensão que trouxe este comércio */
  coletadoPor: string | null;
  /** quem mexeu no status por último — é quem está cuidando do lead */
  responsavel: string | null;
  /** perfil do Instagram, separado do site: muitos comércios têm um e não o outro */
  instagram: string | null;
  /** e-mail do comércio (achado no site, digitado ou importado) */
  email: string | null;
  /** o número para abrir no WhatsApp (55 + DDD + número) e de onde ele veio */
  whatsapp: string | null;
  whatsappFonte: 'link' | 'celular' | null;
  /** o telefone do Maps é celular ou fixo */
  telefoneTipo: TipoTelefone | null;
  /** de onde veio: 'maps' pela extensão, 'manual' cadastrado à mão */
  origem: string;
  /**
   * Endereço do site de prévia publicado para este comércio.
   * Fica no lead, e não dentro da proposta, porque a prévia é usada antes
   * de existir proposta — é ela que abre a conversa.
   */
  previaUrl: string | null;
  /**
   * Dados da Receita Federal, quando o CNPJ foi consultado.
   *
   * Não vem do Maps: é preenchido à mão quando o número aparece no rodapé
   * do site, na nota ou na conversa. Guarda o retorno inteiro porque o que
   * interessa varia — tempo de mercado na abordagem, porte e regime no
   * preço, situação cadastral para não perder tempo com empresa baixada.
   */
  cnpj: unknown | null;
  /**
   * O que você preencheu à mão sobre o comércio para a prévia sair boa.
   *
   * O Maps entrega nome, telefone e endereço; o que faz a landing parecer
   * feita para aquele negócio — cor da marca, o que destacar, os serviços
   * reais, referências visuais — não vem de lugar nenhum e precisa ser
   * digitado uma vez.
   */
  briefing: unknown | null;
  /** quando a mensagem saiu de verdade; null enquanto não saiu */
  contatadoEm: string | null;
  /** a simulação de proposta montada para este lead */
  proposta: unknown | null;
  /** o cliente abriu o link público da proposta: a primeira vez, a última e quantas vezes */
  propostaPrimeiraEm: string | null;
  propostaAbertaEm: string | null;
  propostaAberturas: number;
  /** "ligar dia 12": quando lembrar de voltar a este lead, e o quê */
  lembreteEm: string | null;
  lembreteTexto: string | null;
  /**
   * Caminho público da proposta. Não existe no banco: a rota calcula na
   * hora, porque o token depende de um segredo que só o servidor tem.
   */
  linkProposta?: string;
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
  /** só os que a verificação mostrou que não estão de pé */
  siteQuebrado?: boolean;
  /** quem está cuidando: um nome, ou 'ninguem' para os sem dono */
  responsavel?: string;
  /** níveis de temperatura a mostrar; vazio ou ausente mostra todos */
  temperatura?: Nivel[];
  limit?: number;
  offset?: number;
  ordem?: 'recentes' | 'nome' | 'avaliacoes' | 'temperatura';
}

// ------------------------------------------------------------ util

function normalizarId(bruto: string): string {
  return bruto.trim().toLowerCase().slice(0, 300);
}

/** limpa e reclassifica o que chegou da extensão — nunca confiar no cliente */
export function normalizarLead(
  cru: Record<string, unknown>,
  coletadoPor?: string | null,
  origem: string = 'maps',
): Lead | null {
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
  // só endereço http(s): um "javascript:..." no campo do Maps viraria link clicável no painel
  const link = (v: unknown, max = 900): string | null => {
    const s = texto(v, max);
    return s && /^https?:\/\//i.test(s) ? s : null;
  };

  const phone = texto(cru.phone, 40);
  const telefoneTipo = tipoDoTelefone(phone);
  // WhatsApp achado num link da própria empresa vale mais que o celular do Maps
  const doLink = typeof cru.whatsapp === 'string' ? numeroWhatsapp(cru.whatsapp) : null;
  const doCelular = telefoneTipo === 'celular' ? numeroWhatsapp(phone) : null;

  return {
    id: normalizarId(chave),
    name: nome.slice(0, 250),
    category: texto(cru.category, 120),
    searchTerm: texto(cru.searchTerm, 120),
    city: texto(cru.city, 120),
    phone,
    address: texto(cru.address, 300),
    website: veredito.url,
    websiteKind: veredito.kind,
    websiteLabel: veredito.label,
    isLead: veredito.isLead,
    rating: num(cru.rating),
    reviews: num(cru.reviews),
    mapsUrl: link(cru.mapsUrl),
    lat: num(cru.lat),
    lng: num(cru.lng),
    hours: texto(cru.hours, 200),
    status: 'novo',
    // anotação só vem do cadastro manual e da planilha; numa coleta repetida o update não mexe nela
    notes: texto(cru.notes, 2000),
    instagram: link(cru.instagram, 300),
    email: emailValido(cru.email),
    whatsapp: doLink || doCelular,
    whatsappFonte: doLink ? 'link' : doCelular ? 'celular' : null,
    telefoneTipo,
    origem,
    previaUrl: link(cru.previaUrl, 500),
    cnpj: null,
    briefing: null,
    contatadoEm: null,
    siteStatus: null,
    siteDetalhe: null,
    siteVerificadoEm: null,
    coletadoPor: coletadoPor || null,
    responsavel: null,
    proposta: null,
    propostaPrimeiraEm: null,
    propostaAbertaEm: null,
    propostaAberturas: 0,
    lembreteEm: null,
    lembreteTexto: null,
    createdAt: agora,
    updatedAt: agora,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function daLinha(r: any): Lead {
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
    rating: r.rating === null ? null : Number(r.rating),
    reviews: r.reviews === null ? null : Number(r.reviews),
    mapsUrl: r.maps_url,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    hours: r.hours,
    status: r.status,
    notes: r.notes,
    siteStatus: r.site_status,
    siteDetalhe: r.site_detalhe,
    siteVerificadoEm: r.site_verificado_em ? new Date(r.site_verificado_em).toISOString() : null,
    instagram: r.instagram,
    email: r.email ?? null,
    whatsapp: r.whatsapp ?? null,
    whatsappFonte: r.whatsapp_fonte ?? null,
    telefoneTipo: r.telefone_tipo ?? null,
    origem: r.origem || 'maps',
    previaUrl: r.previa_url,
    cnpj: json(r.cnpj),
    briefing: json(r.briefing),
    contatadoEm: r.contatado_em ? new Date(r.contatado_em).toISOString() : null,
    coletadoPor: r.coletado_por,
    responsavel: r.responsavel,
    proposta: json(r.proposta),
    propostaPrimeiraEm: r.proposta_primeira_em ? new Date(r.proposta_primeira_em).toISOString() : null,
    propostaAbertaEm: r.proposta_aberta_em ? new Date(r.proposta_aberta_em).toISOString() : null,
    propostaAberturas: Number(r.proposta_aberturas) || 0,
    lembreteEm: r.lembrete_em ? new Date(r.lembrete_em).toISOString() : null,
    lembreteTexto: r.lembrete_texto ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------- escrita

export interface ResultadoGravacao {
  recebidos: number;
  novos: number;
  atualizados: number;
  /** comércios novos que ficaram de fora porque a cota da semana acabou */
  barradosPelaCota: number;
}

/** quais destes ids a conta ainda não tem */
export async function idsNovos(conta: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const existentes = await db()`select id from leads where conta_id = ${conta} and id = any(${ids}::text[])`;
  const tem = new Set(existentes.map((r) => r.id as string));
  return ids.filter((id) => !tem.has(id));
}

/**
 * Grava o lote. Um comércio já conhecido tem os dados do Maps atualizados,
 * mas o status e as anotações que você escreveu ficam intactos — senão uma
 * nova varredura apagaria seu trabalho de prospecção.
 *
 * `permitidosNovos` é quantos comércios novos a cota deixa entrar; os que
 * passarem disso são descartados aqui (atualizar um já conhecido não gasta
 * cota). `undefined` significa sem limite.
 */
export async function salvarLeads(conta: string, leads: Lead[], permitidosNovos?: number): Promise<ResultadoGravacao> {
  if (!leads.length) return { recebidos: 0, novos: 0, atualizados: 0, barradosPelaCota: 0 };

  const novosIds = new Set(await idsNovos(conta, leads.map((l) => l.id)));
  let vagas = permitidosNovos ?? Infinity;
  let barrados = 0;
  const aceitos: Lead[] = [];
  for (const l of leads) {
    if (novosIds.has(l.id)) {
      if (vagas <= 0) {
        barrados++;
        continue;
      }
      vagas--;
    }
    aceitos.push(l);
  }

  const sql = db();
  for (const l of aceitos) {
    await sql`
      insert into leads (
        conta_id, id, name, category, search_term, city, phone, address, website,
        website_kind, website_label, is_lead, rating, reviews, maps_url,
        lat, lng, hours, status, coletado_por, instagram, origem, notes,
        whatsapp, whatsapp_fonte, telefone_tipo, email, updated_at
      ) values (
        ${conta}, ${l.id}, ${l.name}, ${l.category}, ${l.searchTerm}, ${l.city}, ${l.phone},
        ${l.address}, ${l.website}, ${l.websiteKind}, ${l.websiteLabel}, ${l.isLead},
        ${l.rating}, ${l.reviews}, ${l.mapsUrl}, ${l.lat}, ${l.lng}, ${l.hours},
        'novo', ${l.coletadoPor}, ${l.instagram}, ${l.origem}, ${l.notes},
        ${l.whatsapp}, ${l.whatsappFonte}, ${l.telefoneTipo}, ${l.email}, now()
      )
      on conflict (conta_id, id) do update set
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
        coletado_por  = coalesce(leads.coletado_por, excluded.coletado_por),
        instagram     = coalesce(excluded.instagram, leads.instagram),
        -- o WhatsApp de link nunca é rebaixado para o "provável" de uma coleta nova
        whatsapp       = case when leads.whatsapp_fonte = 'link' and excluded.whatsapp_fonte is distinct from 'link'
                              then leads.whatsapp else coalesce(excluded.whatsapp, leads.whatsapp) end,
        whatsapp_fonte = case when leads.whatsapp_fonte = 'link' and excluded.whatsapp_fonte is distinct from 'link'
                              then leads.whatsapp_fonte else coalesce(excluded.whatsapp_fonte, leads.whatsapp_fonte) end,
        telefone_tipo  = coalesce(excluded.telefone_tipo, leads.telefone_tipo),
        -- o e-mail que a pessoa corrigiu à mão não é trocado por um achado depois
        email          = coalesce(leads.email, excluded.email),
        updated_at    = now()
    `;
  }

  const novos = aceitos.filter((l) => novosIds.has(l.id)).length;
  return { recebidos: leads.length, novos, atualizados: aceitos.length - novos, barradosPelaCota: barrados };
}

/**
 * Mexer no status ou na anotação marca a pessoa como responsável pelo lead.
 * É assim que quem divide a conta sabe quem já pegou quem, sem precisar
 * combinar nada — e sem ligar duas vezes para o mesmo comércio.
 *
 * Voltar um lead para "novo" solta o responsável: ele fica livre de novo.
 */
export async function atualizarLead(
  conta: string,
  id: string,
  patch: { status?: Status; notes?: string | null; proposta?: unknown; previaUrl?: string | null; cnpj?: unknown; briefing?: unknown; email?: string | null },
  quem?: string | null,
): Promise<Lead | null> {
  const soltar = patch.status === 'novo';
  const [antes] = await db()`select status, notes, proposta, previa_url from leads where conta_id = ${conta} and id = ${id}`;
  const linhas = await db()`
    update leads set
      status      = coalesce(${patch.status ?? null}, status),
      notes       = case when ${patch.notes !== undefined} then ${patch.notes ?? null} else notes end,
      proposta    = case when ${patch.proposta !== undefined}
                         then ${patch.proposta === null || patch.proposta === undefined ? null : JSON.stringify(patch.proposta)}::jsonb
                         else proposta end,
      previa_url  = case when ${patch.previaUrl !== undefined}
                         then ${patch.previaUrl ?? null} else previa_url end,
      cnpj        = case when ${patch.cnpj !== undefined}
                         then ${patch.cnpj === null || patch.cnpj === undefined ? null : JSON.stringify(patch.cnpj)}::jsonb
                         else cnpj end,
      email       = case when ${patch.email !== undefined} then ${patch.email ?? null} else email end,
      briefing    = case when ${patch.briefing !== undefined}
                         then ${patch.briefing === null || patch.briefing === undefined ? null : JSON.stringify(patch.briefing)}::jsonb
                         else briefing end,
      responsavel = case
                      when ${soltar} then null
                      else coalesce(${quem ?? null}, responsavel)
                    end,
      updated_at  = now()
    where conta_id = ${conta} and id = ${id}
    returning *
  `;
  if (!linhas.length) return null;
  if (patch.status) await acompanharNoFunil(conta, id, patch.status);
  const depois = daLinha(linhas[0]);
  if (antes) await anotarMudancas(conta, id, antes, depois, patch, quem ?? null);
  return depois;
}

/** o que mudou vira linha no histórico da ficha (lib/eventos) */
async function anotarMudancas(
  conta: string,
  id: string,
  antes: Record<string, any>,
  depois: Lead,
  patch: { status?: Status; notes?: string | null; proposta?: unknown; previaUrl?: string | null },
  quem: string | null,
): Promise<void> {
  if (patch.status && antes.status !== depois.status) {
    await registrarEvento(conta, id, 'status', `${rotuloDoStatus(antes.status)} → ${rotuloDoStatus(depois.status)}`, quem);
  }
  if (patch.notes !== undefined && (antes.notes || '') !== (depois.notes || '')) {
    await registrarEvento(conta, id, 'nota', depois.notes ? `Anotação: “${depois.notes.slice(0, 160)}”` : 'Anotação apagada', quem);
  }
  if (patch.proposta !== undefined && patch.proposta) {
    const velha = (antes.proposta && typeof antes.proposta === 'object' ? antes.proposta : null) as Record<string, unknown> | null;
    const nova = depois.proposta as Record<string, unknown> | null;
    if (nova?.fechado && !velha?.fechado) await registrarEvento(conta, id, 'proposta_fechada', 'Cliente fechou a proposta', quem);
    else if (!velha) await registrarEvento(conta, id, 'proposta', 'Proposta montada', quem);
    else if (JSON.stringify(velha) !== JSON.stringify(nova)) await registrarEvento(conta, id, 'proposta', 'Proposta atualizada', quem);
  }
  if (patch.previaUrl !== undefined && patch.previaUrl && patch.previaUrl !== antes.previa_url) {
    await registrarEvento(conta, id, 'previa', 'Prévia do site publicada', quem);
  }
}

/**
 * Mudou o status pelo painel (ou fechou pela proposta): o card do CRM vai
 * junto, para a primeira etapa do mesmo funil que corresponde ao novo status.
 * Lead que ainda não está em funil nenhum entra no primeiro funil da conta
 * assim que sai de "novo" — é o que mantém o CRM cheio sem trabalho dobrado.
 * Se o funil não tem etapa para aquele status, o card fica onde está.
 */
async function acompanharNoFunil(conta: string, id: string, status: Status): Promise<void> {
  await db()`
    with atual as (
      select l.etapa_id, e.funil_id, e.situacao
      from leads l left join etapas e on e.id = l.etapa_id
      where l.conta_id = ${conta} and l.id = ${id}
    ),
    funil as (
      select coalesce(
        (select funil_id from atual),
        case when ${status} <> 'novo' then (select id from funis where conta_id = ${conta} order by posicao, criado_em limit 1) end
      ) as id
    ),
    destino as (
      select e.id from etapas e, funil f
      where e.funil_id = f.id and e.conta_id = ${conta} and e.situacao = ${status}
      order by e.posicao limit 1
    )
    update leads set etapa_id = (select id from destino), etapa_em = now(),
      etapa_ordem = extract(epoch from now())
    where conta_id = ${conta} and id = ${id}
      and exists (select 1 from destino)
      and coalesce((select situacao from atual), '') <> ${status}
  `;
}

/**
 * O cliente abriu o link da proposta. Aberturas seguidas contam uma vez a
 * cada 30 minutos — recarregar a página ou voltar a ela logo depois não é
 * "abriu de novo". A data da última abertura sempre atualiza.
 */
export async function marcarPropostaAberta(conta: string, id: string): Promise<void> {
  const r = await db()`
    update leads set
      proposta_aberturas = proposta_aberturas + case
        when proposta_aberta_em is null or proposta_aberta_em < now() - interval '30 minutes' then 1 else 0 end,
      proposta_primeira_em = coalesce(proposta_primeira_em, now()),
      proposta_aberta_em = now()
    where conta_id = ${conta} and id = ${id}
    returning proposta_aberturas, (proposta_aberta_em = proposta_primeira_em) as primeira
  `;
  // no histórico, uma linha por abertura que contou (não a cada recarregar)
  if (r.length) {
    const n = Number(r[0].proposta_aberturas) || 0;
    const [ult] = await db()`select detalhe from lead_eventos where conta_id = ${conta} and lead_id = ${id} and tipo = 'proposta_aberta' order by id desc limit 1`;
    const texto = n <= 1 ? 'Cliente abriu a proposta' : `Cliente abriu a proposta de novo (${n}ª vez)`;
    if (!ult || ult.detalhe !== texto) await registrarEvento(conta, id, 'proposta_aberta', texto, null);
  }
}

/**
 * Guarda o resultado da verificação do site.
 *
 * Quando a checagem mostra que o site não está de pé, o comércio volta a
 * ser oportunidade (is_lead), porque na prática ele está sem site — mesmo
 * tendo um endereço cadastrado no Google.
 */
export async function marcarVerificacao(
  conta: string,
  id: string,
  v: { status: string; detalhe: string; viraLead: boolean },
): Promise<void> {
  await db()`
    update leads set
      site_status        = ${v.status},
      site_detalhe       = ${v.detalhe},
      site_verificado_em = now(),
      is_lead            = case when ${v.viraLead} then true else is_lead end,
      updated_at         = now()
    where conta_id = ${conta} and id = ${id}
  `;
}

/** os leads que têm site cadastrado e ainda não foram verificados */
export async function paraVerificar(conta: string, limite: number): Promise<Lead[]> {
  const linhas = await db()`
    select * from leads
    where conta_id = ${conta} and website is not null and website <> '' and site_status is null
    order by created_at desc
    limit ${limite}
  `;
  return linhas.map(daLinha);
}

/** quantos ainda faltam verificar */
export async function faltamVerificar(conta: string): Promise<number> {
  const r = await db()`
    select count(*)::int as n from leads
    where conta_id = ${conta} and website is not null and website <> '' and site_status is null
  `;
  return r[0].n as number;
}

/** um lead só — usado pela página pública da proposta, que já resolveu a conta pelo token */
export async function buscarLead(conta: string, id: string): Promise<Lead | null> {
  const linhas = await db()`select * from leads where conta_id = ${conta} and id = ${id} limit 1`;
  return linhas.length ? daLinha(linhas[0]) : null;
}

export async function apagarLead(conta: string, id: string): Promise<boolean> {
  const r = await db()`delete from leads where conta_id = ${conta} and id = ${id} returning id`;
  return r.length > 0;
}

/**
 * Apaga exatamente os leads que um conjunto de filtros seleciona.
 *
 * Existe em vez de um "apagar tudo" seco porque limpar a base inteira
 * raramente é o que se quer: o caso comum é varrer os frios, ou os de uma
 * cidade que não compensou. Sem filtro nenhum, isto é o apagar tudo.
 *
 * Recebe os ids já resolvidos pela mesma função que monta a lista na tela,
 * então o que some é o que estava à vista — e não um conjunto diferente
 * porque a consulta de apagar interpretou o filtro de outro jeito.
 */
export async function apagarPorFiltro(conta: string, f: Filtros): Promise<number> {
  const alvos = await todosOsLeads(conta, { ...f, limit: 2000, offset: 0 });
  const ids = alvos.map((l) => l.id);
  if (!ids.length) return 0;
  const r = await db()`delete from leads where conta_id = ${conta} and id = any(${ids}::text[]) returning id`;
  return r.length;
}

// ---------------------------------------------------------- leitura

export interface PaginaDeLeads {
  leads: Lead[];
  total: number;
  resumo: Record<string, number>;
  cidades: string[];
  categorias: string[];
}

export async function listarLeads(conta: string, f: Filtros): Promise<PaginaDeLeads> {
  const sql = db();
  const limit = Math.min(f.limit ?? 200, 2000);
  const offset = f.offset ?? 0;

  // filtros opcionais com o truque do "parâmetro nulo desliga a condição"
  const kinds = f.kinds?.length ? f.kinds : null;
  const statusList = f.status?.length ? f.status : null;
  const busca = f.busca ? `%${f.busca}%` : null;
  const city = f.city ? `%${f.city}%` : null;
  const category = f.category ? `%${f.category}%` : null;
  const ordem = f.ordem || 'recentes';

  /*
   * Temperatura não é coluna: é regra em TypeScript, e traduzi-la para SQL
   * criaria uma segunda cópia que sai do lugar na primeira vez que os pesos
   * mudarem. Então nesse modo a consulta traz o conjunto filtrado inteiro,
   * a nota é calculada aqui e a página é recortada depois. O teto de 5.000
   * existe para uma base grande não virar uma varredura silenciosa.
   */
  const porTemperatura = ordem === 'temperatura' || Boolean(f.temperatura?.length);
  const limitSql = porTemperatura ? 5000 : limit;
  const offsetSql = porTemperatura ? 0 : offset;

  const onde = sql`
    conta_id = ${conta}
      and (${kinds}::text[] is null or website_kind = any(${kinds}::text[]))
      and (${statusList}::text[] is null or status = any(${statusList}::text[]))
      and (${f.somenteLeads ? true : null}::boolean is null or is_lead = true)
      and (${f.comTelefone ? true : null}::boolean is null or (phone is not null and phone <> ''))
      and (${f.siteQuebrado ? true : null}::boolean is null or site_status = any(${SITE_QUEBRADO}::text[]))
      and (${f.responsavel ?? null}::text is null
           or (${f.responsavel === 'ninguem'} and responsavel is null)
           or responsavel = ${f.responsavel ?? null})
      and (${city}::text is null or city ilike ${city})
      and (${category}::text is null or category ilike ${category})
      and (${busca}::text is null or name ilike ${busca} or address ilike ${busca}
           or phone ilike ${busca} or category ilike ${busca} or city ilike ${busca})
  `;

  const [linhas, totalRow, porTipo, porStatus, oportunidades, porPessoa, quebrados, cidades, categorias, paraTemperatura] =
    await Promise.all([
      sql`
        select * from leads where ${onde}
        order by
          case when ${ordem} = 'nome' then name end asc,
          case when ${ordem} = 'avaliacoes' then reviews end desc nulls last,
          created_at desc
        limit ${limitSql} offset ${offsetSql}
      `,
      sql`select count(*)::int as n from leads where ${onde}`,
      sql`select website_kind, count(*)::int as n from leads where conta_id = ${conta} group by website_kind`,
      sql`select status, count(*)::int as n from leads where conta_id = ${conta} group by status`,
      // "oportunidade" segue o is_lead, que a verificação de site também altera:
      // um comércio cujo site caiu volta para a lista mesmo tendo endereço cadastrado
      sql`select count(*)::int as n from leads where conta_id = ${conta} and is_lead = true`,
      sql`select coalesce(responsavel, 'ninguem') as quem, count(*)::int as n from leads where conta_id = ${conta} group by 1`,
      sql`select count(*)::int as n from leads where conta_id = ${conta} and site_status = any(${SITE_QUEBRADO}::text[])`,
      sql`select distinct city from leads where conta_id = ${conta} and city is not null order by city limit 200`,
      sql`select distinct category from leads where conta_id = ${conta} and category is not null order by category limit 300`,
      /*
       * Contagem por temperatura para os botões de filtro mostrarem número.
       * Não dá para agregar em SQL porque a nota é regra em TypeScript, então
       * vem só o punhado de colunas que o cálculo usa.
       */
      sql`
        select website_kind, site_status, site_verificado_em, reviews, rating, instagram, phone, category
        from leads where conta_id = ${conta} limit 5000
      `,
    ]);

  const resumo: Record<string, number> = { total: 0 };
  for (const r of porTipo) {
    resumo[r.website_kind] = r.n;
    resumo.total += r.n;
  }
  for (const r of porStatus) resumo['status_' + r.status] = r.n;
  resumo.oportunidades = oportunidades[0].n;
  for (const r of porPessoa) resumo['de_' + r.quem] = r.n;
  resumo.site_quebrado = quebrados[0].n;

  for (const r of paraTemperatura) {
    const nivel = temperaturaDoLead({
      websiteKind: r.website_kind,
      siteStatus: r.site_status,
      siteVerificadoEm: r.site_verificado_em,
      reviews: r.reviews === null ? null : Number(r.reviews),
      rating: r.rating === null ? null : Number(r.rating),
      instagram: r.instagram,
      phone: r.phone,
      category: r.category,
    } as unknown as Lead).nivel;
    resumo['temp_' + nivel] = (resumo['temp_' + nivel] || 0) + 1;
  }

  let mapeados = linhas.map(daLinha);

  /*
   * Quando a temperatura entra — como filtro ou como ordenação —, o total
   * da paginação precisa ser o do conjunto já filtrado, senão o rodapé diz
   * "200 leads" numa lista de doze quentes.
   */
  let totalReal: number | null = null;
  if (f.temperatura?.length) {
    mapeados = mapeados.filter((l) => f.temperatura!.includes(temperaturaDoLead(l).nivel));
    totalReal = mapeados.length;
  }

  const pagina =
    ordem === 'temperatura'
      ? [...mapeados]
          .sort((a, b) => temperaturaDoLead(b).pontos - temperaturaDoLead(a).pontos)
          .slice(offset, offset + limit)
      : porTemperatura
        ? mapeados.slice(offset, offset + limit)
        : mapeados;

  return {
    leads: pagina,
    total: totalReal ?? totalRow[0].n,
    resumo,
    cidades: cidades.map((r) => r.city as string),
    categorias: categorias.map((r) => r.category as string),
  };
}

const SITE_QUEBRADO = ['fora_do_ar', 'nao_encontrado', 'em_construcao', 'virou_social', 'certificado_vencido', 'sem_https'];

export async function todosOsLeads(conta: string, f: Filtros): Promise<Lead[]> {
  const p = await listarLeads(conta, { ...f, limit: 2000, offset: 0 });
  return p.leads;
}
