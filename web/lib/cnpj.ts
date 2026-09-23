/**
 * Consulta o CNPJ na Receita Federal e devolve o que muda a conversa.
 *
 * Não serve para descobrir lead: nenhuma das APIs públicas busca por nome
 * — a ReceitaWS responde "CNPJ inválido" para qualquer busca textual — e o
 * Google Maps não entrega CNPJ. Então isto entra depois, quando o lead já
 * esquentou e o número apareceu no rodapé do site, na nota fiscal, no
 * Instagram ou na própria conversa.
 *
 * O ganho está no preço. O motor de proposta multiplica por porte (1 a
 * 2,6) e por formalização (0,92 a 1,15), e hoje os dois são escolhidos no
 * olho. Com o CNPJ eles vêm da Receita, e de quebra vem o tempo de
 * mercado, que é o que diz se o comércio tem lastro ou abriu mês passado.
 *
 * Usa a BrasilAPI como principal porque é grátis, dispensa chave e aguenta
 * rajada. A ReceitaWS fica de reserva: o plano gratuito dela é de três
 * consultas por minuto — medido, a terceira já devolve 429.
 */

import type { Formalizacao, Porte } from './catalogo';

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  /** ISO, como '1973-09-28' */
  aberturaEm: string | null;
  /** anos completos desde a abertura */
  anosDeMercado: number | null;
  situacao: string | null;
  /** true quando a Receita não diz "ATIVA" — comércio baixado não compra site */
  irregular: boolean;
  capitalSocial: number | null;
  municipio: string | null;
  uf: string | null;
  atividade: string | null;
  /** o que sugerir na proposta, já traduzido para os campos de lá */
  porteSugerido: Porte;
  formalizacaoSugerida: Formalizacao;
  fonte: 'brasilapi' | 'receitaws';
}

/** aceita "12.345.678/0001-95" ou só os dígitos */
export function limparCnpj(bruto: string): string {
  return (bruto || '').replace(/\D/g, '');
}

/**
 * Valida pelos dois dígitos verificadores.
 *
 * Vale a pena antes de qualquer requisição: digitar CNPJ errado é comum, e
 * um dígito trocado gasta uma consulta e devolve "não encontrado", que
 * parece problema da API quando é erro de digitação.
 */
export function cnpjValido(bruto: string): boolean {
  const c = limparCnpj(bruto);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // 00000000000000 e afins

  const digito = (base: string): number => {
    let peso = base.length - 7;
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };

  return digito(c.slice(0, 12)) === Number(c[12]) && digito(c.slice(0, 13)) === Number(c[13]);
}

export function formatarCnpj(bruto: string): string {
  const c = limparCnpj(bruto);
  if (c.length !== 14) return bruto;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function anosDesde(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const anos = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return anos < 0 ? null : Math.floor(anos);
}

/**
 * Traduz porte e regime da Receita para os campos da proposta.
 *
 * O porte da Receita é declaratório e grosseiro — "DEMAIS" cobre desde
 * empresa média até multinacional —, então o capital social desempata.
 * Errar para baixo é mais seguro: proposta cara demais some sem resposta,
 * enquanto proposta barata ainda pode ser renegociada.
 */
function classificar(porteReceita: string | null, capital: number | null, mei: boolean, simples: boolean) {
  const p = (porteReceita || '').toUpperCase();
  const cap = capital ?? 0;

  let porte: Porte = 'micro';
  if (mei || p.includes('MICRO EMPRESA') || p === 'ME') porte = 'micro';
  else if (p.includes('PEQUENO') || p === 'EPP') porte = 'pequena';
  else if (cap >= 5_000_000) porte = 'grande';
  else if (cap >= 500_000) porte = 'media';
  else if (cap >= 100_000) porte = 'pequena';

  const formalizacao: Formalizacao = mei ? 'mei' : simples ? 'simples' : porte === 'micro' ? 'desconhecido' : 'ltda';
  return { porte, formalizacao };
}

/*
 * A BrasilAPI devolve 403 para requisição sem User-Agent — por isso
 * funciona no curl e falhava silenciosamente vindo do servidor, caindo
 * sempre na reserva de três consultas por minuto sem ninguém perceber.
 */
const AGENTE = 'vertion-leads/1.0 (+https://vertionstack-leads.vercel.app)';

async function pelaBrasilApi(c: string): Promise<DadosCnpj | null> {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, {
    headers: { accept: 'application/json', 'user-agent': AGENTE },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) return null;

  const d = (await r.json()) as Record<string, unknown>;
  const situacao = (d.descricao_situacao_cadastral as string) || null;
  const mei = d.opcao_pelo_mei === true;
  const simples = d.opcao_pelo_simples === true;
  const capital = typeof d.capital_social === 'number' ? d.capital_social : null;
  const abertura = (d.data_inicio_atividade as string) || null;
  const { porte, formalizacao } = classificar((d.porte as string) || null, capital, mei, simples);

  return {
    cnpj: c,
    razaoSocial: (d.razao_social as string) || null,
    nomeFantasia: ((d.nome_fantasia as string) || '').trim() || null,
    aberturaEm: abertura,
    anosDeMercado: anosDesde(abertura),
    situacao,
    irregular: Boolean(situacao) && situacao!.toUpperCase() !== 'ATIVA',
    capitalSocial: capital,
    municipio: (d.municipio as string) || null,
    uf: (d.uf as string) || null,
    atividade: (d.cnae_fiscal_descricao as string) || null,
    porteSugerido: porte,
    formalizacaoSugerida: formalizacao,
    fonte: 'brasilapi',
  };
}

/**
 * Reserva. Campos e formatos são outros: a data vem como "24/10/1966" e o
 * capital como texto.
 */
async function pelaReceitaWs(c: string): Promise<DadosCnpj | null> {
  const r = await fetch(`https://receitaws.com.br/v1/cnpj/${c}`, {
    headers: { accept: 'application/json', 'user-agent': AGENTE },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) return null;

  const d = (await r.json()) as Record<string, unknown>;
  if (d.status === 'ERROR') return null;

  const br = (d.abertura as string) || '';
  const abertura = /^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.split('/').reverse().join('-') : null;
  const capital = Number(String(d.capital_social ?? '').replace(/[^\d.]/g, '')) || null;
  const situacao = (d.situacao as string) || null;
  const porteTexto = (d.porte as string) || null;
  const mei = /MEI|MICRO EMPREENDEDOR/i.test(porteTexto || '');
  const { porte, formalizacao } = classificar(porteTexto, capital, mei, false);

  const atividades = d.atividade_principal as { text?: string }[] | undefined;

  return {
    cnpj: c,
    razaoSocial: (d.nome as string) || null,
    nomeFantasia: ((d.fantasia as string) || '').trim() || null,
    aberturaEm: abertura,
    anosDeMercado: anosDesde(abertura),
    situacao,
    irregular: Boolean(situacao) && !/ATIVA/i.test(situacao!),
    capitalSocial: capital,
    municipio: (d.municipio as string) || null,
    uf: (d.uf as string) || null,
    atividade: atividades?.[0]?.text || null,
    fonte: 'receitaws',
    porteSugerido: porte,
    formalizacaoSugerida: formalizacao,
  };
}

export async function consultarCnpj(bruto: string): Promise<{ ok: true; dados: DadosCnpj } | { ok: false; erro: string }> {
  const c = limparCnpj(bruto);
  if (!cnpjValido(c)) return { ok: false, erro: 'CNPJ inválido — confira os números digitados.' };

  try {
    const dados = (await pelaBrasilApi(c)) || (await pelaReceitaWs(c));
    if (!dados) {
      return { ok: false, erro: 'CNPJ não encontrado na Receita, ou as duas consultas estão fora do ar agora.' };
    }
    return { ok: true, dados };
  } catch {
    return { ok: false, erro: 'Não consegui falar com a Receita agora. Tente de novo em alguns segundos.' };
  }
}
