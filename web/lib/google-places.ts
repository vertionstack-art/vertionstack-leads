/**
 * Busca de comércios pelo Google (Places API, Text Search), no lugar da
 * extensão que lia o Maps no navegador.
 *
 * Cada chamada traz até 20 comércios e custa o mesmo com 20 ou com 3, por
 * isso o servidor conta tudo (busca_google) e para antes do teto diário.
 * A chave do Google só existe aqui no servidor: o navegador nunca a vê.
 *
 * O Google entrega no máximo 60 comércios por pergunta (3 páginas). Para
 * cobrir uma cidade, a tela pergunta bairro por bairro.
 */

import { db } from './sql';

const URL_BUSCA = 'https://places.googleapis.com/v1/places:searchText';

// Só o que a ferramenta usa. Site, telefone e avaliações puxam o SKU
// Enterprise; pedir menos não ajudaria, porque o site é a razão da busca.
const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.location',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',');

export interface ComercioGoogle {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  nota: number | null;
  avaliacoes: number | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  tipo: string | null;
}

export interface PaginaGoogle {
  comercios: ComercioGoogle[];
  proxima: string | null;
}

export function buscaLigada(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_KEY) || modoFalso();
}

/** só no computador de desenvolvimento, para testar a tela sem gastar */
function modoFalso(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.GOOGLE_PLACES_FALSO === '1';
}

/** quantas chamadas ao Google a ferramenta inteira pode fazer por dia */
export function tetoDiario(): number {
  const n = Number(process.env.BUSCA_TETO_DIA);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

/**
 * Quantas chamadas por mês. O Google dá 1.000 chamadas grátis por mês no
 * Text Search Enterprise; o padrão de 950 deixa folga para o mês do Google
 * (que vira no horário dos EUA) não começar a cobrar antes do nosso. Para
 * permitir gasto, suba BUSCA_TETO_MES na Vercel.
 */
export function tetoMensal(): number {
  const n = Number(process.env.BUSCA_TETO_MES);
  return Number.isFinite(n) && n > 0 ? n : 950;
}

/** a faixa grátis do Google e o preço depois dela (US$ por chamada) */
export const GRATIS_POR_MES = 1000;
export const DOLAR_POR_CHAMADA = 0.035;

export class ErroGoogle extends Error {
  constructor(msg: string, public status: number) {
    super(msg);
  }
}

export async function buscarPagina(pergunta: string, pagina: string | null): Promise<PaginaGoogle> {
  if (modoFalso() && !process.env.GOOGLE_PLACES_KEY) return paginaFalsa(pergunta, pagina);

  const r = await fetch(URL_BUSCA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY!,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify({ textQuery: pergunta, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, ...(pagina ? { pageToken: pagina } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    console.error('[google places]', r.status, corpo.slice(0, 500));
    throw new ErroGoogle(
      r.status === 429 ? 'O Google pediu para esperar um pouco. Tente de novo em um minuto.' : 'A busca no Google falhou. Tente de novo.',
      r.status,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (await r.json()) as { places?: any[]; nextPageToken?: string };
  const comercios = (d.places || [])
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .map((p) => ({
      id: String(p.id),
      nome: p.displayName?.text || '',
      endereco: p.formattedAddress || null,
      telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
      site: p.websiteUri || null,
      nota: typeof p.rating === 'number' ? p.rating : null,
      avaliacoes: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
      mapsUrl: p.googleMapsUri || null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      tipo: p.primaryTypeDisplayName?.text || null,
    }))
    .filter((c) => c.nome);
  return { comercios, proxima: d.nextPageToken || null };
}

/** conta a chamada (e o que rendeu) no dia de Brasília */
export async function contarChamada(conta: string, resultados: number, leads: number): Promise<void> {
  await db()`
    insert into busca_google (conta_id, dia, chamadas, resultados, leads)
    values (${conta}, (now() at time zone 'America/Sao_Paulo')::date, 1, ${resultados}, ${leads})
    on conflict (conta_id, dia) do update set
      chamadas = busca_google.chamadas + 1,
      resultados = busca_google.resultados + excluded.resultados,
      leads = busca_google.leads + excluded.leads
  `;
}

export async function somarLeads(conta: string, leads: number): Promise<void> {
  if (leads <= 0) return;
  await db()`
    update busca_google set leads = leads + ${leads}
    where conta_id = ${conta} and dia = (now() at time zone 'America/Sao_Paulo')::date
  `;
}

export interface UsoDoMes {
  chamadas: number;
  comercios: number;
  leads: number;
  teto: number;
  gratis: number;
  /** estimativa pela tabela do Google; a fatura oficial fica no Google Cloud */
  custoDolares: number;
}

export async function usoDoMes(): Promise<UsoDoMes> {
  const [r] = await db()`
    select coalesce(sum(chamadas), 0)::int as chamadas, coalesce(sum(resultados), 0)::int as comercios,
           coalesce(sum(leads), 0)::int as leads
    from busca_google
    where date_trunc('month', dia) = date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)
  `;
  const chamadas = r.chamadas as number;
  return {
    chamadas,
    comercios: r.comercios as number,
    leads: r.leads as number,
    teto: tetoMensal(),
    gratis: GRATIS_POR_MES,
    custoDolares: Math.max(0, chamadas - GRATIS_POR_MES) * DOLAR_POR_CHAMADA,
  };
}

// ------------------------------------------------ memória das buscas

/** quanto tempo uma pergunta esgotada fica sem ser refeita (comércio novo aparece com o tempo) */
const DIAS_ESGOTADA = 30;
/** quanto tempo confiamos no token de página do Google para continuar de onde parou */
const MINUTOS_TOKEN = 45;

export function chaveDaPergunta(pergunta: string): string {
  return pergunta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export interface Memoria {
  /** já foi até a última página nos últimos dias: não vale chamar o Google de novo */
  esgotada: boolean;
  /** token para continuar da página onde parou, se ainda vale */
  proxima: string | null;
  paginas: number;
}

export async function memoriaDaBusca(conta: string, chave: string): Promise<Memoria | null> {
  const [r] = await db()`
    select paginas, proxima, esgotada,
           atualizada_em > now() - make_interval(days => ${DIAS_ESGOTADA}) as recente,
           proxima_em > now() - make_interval(mins => ${MINUTOS_TOKEN}) as token_vale
    from buscas_feitas where conta_id = ${conta} and pergunta = ${chave}
  `;
  if (!r) return null;
  return {
    esgotada: Boolean(r.esgotada && r.recente),
    proxima: r.token_vale && !r.esgotada ? (r.proxima as string) : null,
    paginas: r.paginas as number,
  };
}

export async function anotarBusca(conta: string, chave: string, proxima: string | null, recomecou: boolean): Promise<void> {
  await db()`
    insert into buscas_feitas (conta_id, pergunta, paginas, proxima, proxima_em, esgotada, atualizada_em)
    values (${conta}, ${chave}, 1, ${proxima}, now(), ${!proxima}, now())
    on conflict (conta_id, pergunta) do update set
      paginas = case when ${recomecou} then 1 else buscas_feitas.paginas + 1 end,
      proxima = excluded.proxima,
      proxima_em = now(),
      esgotada = excluded.esgotada,
      atualizada_em = now()
  `;
}

export async function chamadasDeHoje(): Promise<number> {
  const [r] = await db()`
    select coalesce(sum(chamadas), 0)::int as n from busca_google
    where dia = (now() at time zone 'America/Sao_Paulo')::date
  `;
  return r.n as number;
}

// ------------------------------------------------------- modo falso

function paginaFalsa(pergunta: string, pagina: string | null): PaginaGoogle {
  const n = pagina ? Number(pagina) : 0;
  const base = pergunta.split(' em ')[0];
  const comercios: ComercioGoogle[] = Array.from({ length: n < 2 ? 20 : 11 }, (_, i) => {
    const k = n * 20 + i;
    const site = k % 3 === 0 ? `https://www.${base.toLowerCase().replace(/\W+/g, '')}${k}.com.br` : k % 5 === 0 ? `https://instagram.com/loja${k}` : null;
    return {
      id: `falso-${base}-${k}`.toLowerCase(),
      nome: `${base} Exemplo ${k + 1}`,
      endereco: `Rua ${k + 1}, Centro`,
      telefone: k % 7 === 0 ? null : `(63) 98${String(100000 + k * 37).slice(0, 3)}-${String(1000 + k)}`,
      site,
      nota: 3.8 + (k % 12) / 10,
      avaliacoes: 5 + k * 9,
      mapsUrl: 'https://maps.google.com/?q=' + encodeURIComponent(base + ' ' + k),
      lat: -11.73,
      lng: -49.07,
      tipo: base,
    };
  });
  return { comercios, proxima: n < 2 ? String(n + 1) : null };
}
