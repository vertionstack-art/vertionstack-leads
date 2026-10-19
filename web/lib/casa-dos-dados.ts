/**
 * Acha o CNPJ de um comércio que veio do Google Maps.
 *
 * O Maps entrega nome, telefone e cidade, mas nunca o CNPJ — e sem ele o
 * lead quente fica no chute: não dá para saber se a empresa está ativa, há
 * quanto tempo existe, de que tamanho é nem quem é o dono. A Casa dos Dados
 * tem a base da Receita com busca por telefone e por nome, que é justamente
 * o que o Maps tem.
 *
 * Só serve para ENCONTRAR o número. Os dados da empresa vêm depois pela
 * BrasilAPI (lib/cnpj), que é grátis — assim cada lead gasta uma ou duas
 * pesquisas na Casa dos Dados e nada mais.
 *
 * Na dúvida, não chuta: CNPJ errado colado num lead é pior que nenhum, porque
 * a proposta sai com porte e regime de outra empresa e a abordagem chama o
 * dono pelo nome de um estranho.
 *
 * Documentação: https://docs.casadosdados.com.br — chave em CASA_DOS_DADOS_API_KEY.
 */

import { digitosNacionais } from './telefone';

const BASE = 'https://api.casadosdados.com.br';

export type Achado =
  | { status: 'achado'; cnpj: string; por: 'telefone' | 'nome' }
  | { status: 'nao_achado' }
  | { status: 'ambiguo'; candidatos: number }
  | { status: 'sem_saldo' }
  | { status: 'erro'; erro: string };

interface Resultado {
  cnpj: string;
  cnpj_raiz?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  matriz_filial?: string | null;
  /** vem como texto ou como objeto com a situação atual, conforme a versão */
  situacao_cadastral?: unknown;
}

function ativa(r: Resultado): boolean {
  const t = JSON.stringify(r.situacao_cadastral ?? '').toUpperCase();
  return t.includes('ATIVA') && !/BAIXADA|INAPTA|NULA|SUSPENSA/.test(t);
}

export function casaDosDadosConfigurada(): boolean {
  return Boolean(process.env.CASA_DOS_DADOS_API_KEY);
}

/** "Gurupi, TO" → { municipio: 'gurupi', uf: 'to' }; a API compara sem acento e em minúsculas */
export function cidadeParaFiltro(city: string | null | undefined): { municipio: string; uf: string | null } | null {
  const partes = String(city || '')
    .split(/[,–-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!partes.length) return null;
  const ultima = partes[partes.length - 1];
  const temUf = partes.length >= 2 && /^[A-Za-z]{2}$/.test(ultima);
  const municipio = semAcento(temUf ? partes[partes.length - 2] : ultima);
  return municipio ? { municipio, uf: temUf ? ultima.toLowerCase() : null } : null;
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** palavras que não distinguem um comércio do outro */
const VAZIAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'the', 'ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'loja', 'casa',
  'comercio', 'servicos', 'restaurante', 'barbearia', 'salao', 'clinica', 'studio', 'estudio',
]);

function palavras(t: string | null | undefined): string[] {
  return semAcento(String(t || ''))
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !VAZIAS.has(p));
}

/** quanto do nome do Maps aparece no nome da Receita (0 a 1) */
function parecenca(nomeMaps: string, r: Resultado): number {
  const alvo = palavras(nomeMaps);
  if (!alvo.length) return 0;
  const dela = new Set([...palavras(r.nome_fantasia), ...palavras(r.razao_social)]);
  return alvo.filter((p) => dela.has(p)).length / alvo.length;
}

async function pesquisar(filtro: Record<string, unknown>): Promise<Resultado[] | 'sem_saldo'> {
  const r = await fetch(`${BASE}/v5/cnpj/pesquisa?tipo_resultado=simples`, {
    method: 'POST',
    headers: {
      'api-key': process.env.CASA_DOS_DADOS_API_KEY || '',
      'content-type': 'application/json',
      accept: 'application/json',
    },
    // sem filtrar situação: empresa baixada também precisa ser achada, para virar lead frio
    body: JSON.stringify({ limite: 10, pagina: 1, ...filtro }),
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status === 403) return 'sem_saldo';
  if (!r.ok) throw new Error(`Casa dos Dados respondeu ${r.status}`);
  const d = (await r.json()) as { cnpjs?: Resultado[] };
  return d.cnpjs || [];
}

/**
 * Entre vários resultados, fica com um só se não houver dúvida: todos são a
 * mesma empresa (matriz e filiais, mesma raiz) ou só um tem o nome parecido
 * com o do Maps.
 */
function escolher(nome: string, todos: Resultado[], exigirNome: boolean): Resultado | 'ambiguo' | null {
  if (!todos.length) return null;
  // o mesmo telefone num CNPJ antigo baixado e num novo ativo: vale o ativo
  const ativos = todos.filter(ativa);
  const lista = ativos.length ? ativos : todos;

  const notas = lista.map((r) => ({ r, nota: parecenca(nome, r) }));
  const parecidos = notas.filter((x) => x.nota >= 0.5);

  if (lista.length === 1) {
    if (!exigirNome || parecidos.length) return lista[0];
    return null;
  }

  const raizes = new Set(lista.map((r) => r.cnpj_raiz || r.cnpj.slice(0, 8)));
  if (raizes.size === 1 && (!exigirNome || parecidos.length)) {
    return lista.find((r) => /matriz/i.test(r.matriz_filial || '')) || lista[0];
  }

  if (parecidos.length === 1) return parecidos[0].r;
  const melhor = Math.max(...notas.map((x) => x.nota));
  const empatados = notas.filter((x) => x.nota === melhor && melhor >= 0.5);
  if (empatados.length === 1) return empatados[0].r;
  return 'ambiguo';
}

export async function acharCnpj(lead: { name: string; phone: string | null; city: string | null }): Promise<Achado> {
  if (!casaDosDadosConfigurada()) return { status: 'erro', erro: 'Chave da Casa dos Dados não configurada.' };

  const local = cidadeParaFiltro(lead.city);
  const filtroLocal: Record<string, unknown> = local
    ? { municipio: [local.municipio], ...(local.uf ? { uf: [local.uf] } : {}) }
    : {};

  try {
    /*
     * 1) Pelo telefone. É o caminho mais preciso: o número do Maps quase
     * sempre é o mesmo que o dono deu ao abrir o CNPJ. Celular de dono pode
     * estar em mais de uma empresa dele, por isso o nome ainda desempata.
     */
    const tel = digitosNacionais(lead.phone);
    let ambiguos = 0;
    if (tel) {
      const r = await pesquisar({ telefone: [tel] });
      if (r === 'sem_saldo') return { status: 'sem_saldo' };
      const e = escolher(lead.name, r, false);
      if (e && e !== 'ambiguo') return { status: 'achado', cnpj: e.cnpj, por: 'telefone' };
      if (e === 'ambiguo') ambiguos = r.length;
    }

    /*
     * 2) Pelo nome, só dentro da cidade. Aqui o nome precisa bater de
     * verdade — "Barbearia Central" existe em toda cidade do país.
     */
    if (!local) return ambiguos ? { status: 'ambiguo', candidatos: ambiguos } : { status: 'nao_achado' };
    const termos = palavras(lead.name);
    if (!termos.length) return ambiguos ? { status: 'ambiguo', candidatos: ambiguos } : { status: 'nao_achado' };

    const r = await pesquisar({
      ...filtroLocal,
      busca_textual: [
        { texto: [termos.join(' ')], tipo_busca: 'radical', razao_social: true, nome_fantasia: true, nome_socio: false },
      ],
    });
    if (r === 'sem_saldo') return { status: 'sem_saldo' };
    const e = escolher(lead.name, r, true);
    if (e && e !== 'ambiguo') return { status: 'achado', cnpj: e.cnpj, por: 'nome' };
    if (e === 'ambiguo' || ambiguos) return { status: 'ambiguo', candidatos: Math.max(r.length, ambiguos) };
    return { status: 'nao_achado' };
  } catch (err) {
    return { status: 'erro', erro: String((err as Error).message).slice(0, 160) };
  }
}
