/**
 * Monta a proposta a partir do que foi marcado.
 *
 * Uma lista, um preço: cada serviço entra ou não entra. A versão anterior
 * dividia tudo em Essencial, Completo e Premium, o que obrigava a decidir
 * duas coisas por item — se ele entra e em qual faixa — quando a conversa
 * com o comerciante é só sobre o que ele vai levar.
 *
 * Sobre os limites: o piso não é preferência, é sobrevivência — abaixo
 * dele o trabalho sai de graça ou no prejuízo. O teto é o contrário: um
 * número que impede pedir demais de quem não pode pagar, e que sobe junto
 * com o porte do cliente, porque cobrar de uma rede o mesmo que de uma
 * barbearia de uma cadeira é deixar dinheiro na mesa.
 */

import { CATALOGO, PORTES, FORMALIZACOES, type Porte, type Formalizacao } from './catalogo';

/** id do serviço -> está incluso */
export type Marcacoes = Record<string, boolean>;

export interface ConfigProposta {
  marcacoes: Marcacoes;
  porte: Porte;
  formalizacao: Formalizacao;
  /** desconto manual em % aplicado no fim */
  desconto?: number;
  /**
   * Solta o teto do porte. Serve para escopo grande de verdade — uma
   * landing somada a uma loja virtual custa mais mesmo, e aí o teto
   * esconderia o preço certo em vez de proteger o cliente.
   */
  ignorarTeto?: boolean;
  /** o cliente fechou: muda o documento de proposta para confirmação */
  fechado?: boolean;
}

export interface ItemDaProposta {
  id: string;
  nome: string;
  beneficio: string;
  mensal: boolean;
  /** o cliente vê como cortesia; o valor já está embutido no total */
  brinde: boolean;
}

export interface Proposta {
  itens: ItemDaProposta[];
  /** valor de entrada, cobrado uma vez */
  entrada: number;
  /** valor por mês */
  mensalidade: number;
  /** o que sai do seu bolso */
  custoUnico: number;
  custoMensal: number;
  /** quanto sobra da entrada depois dos custos */
  margemEntrada: number;
  avisos: string[];
}

// ------------------------------------------------------------ limites

/** abaixo disto o projeto não se paga */
export const PISO_ABSOLUTO = 387.45;
/** onde a proposta deveria chegar */
export const ALVO_MINIMO = 500;
/** teto para um cliente micro; sobe com o porte */
export const TETO_BASE = 1200;

/** termina em ,45 como o piso — número quebrado passa impressão de conta feita */
function arredondar(v: number): number {
  if (v <= PISO_ABSOLUTO) return PISO_ABSOLUTO;
  return Math.round(v / 10) * 10 - 0.55;
}

function arredondarMensal(v: number): number {
  if (v <= 0) return 0;
  return Math.max(47, Math.round(v / 10) * 10 - 3);
}

export function tetoDoPorte(porte: Porte): number {
  return Math.round(TETO_BASE * PORTES[porte].fator);
}

export function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Aceita o formato antigo, em que cada item guardava o plano em que entrava
 * ('basico' | 'intermediario' | 'avancado'). Propostas salvas antes desta
 * mudança continuam abrindo: qualquer valor preenchido vira "incluso".
 */
export function normalizarMarcacoes(bruto: unknown): Marcacoes {
  const saida: Marcacoes = {};
  if (!bruto || typeof bruto !== 'object') return saida;
  for (const [id, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (valor) saida[id] = true;
  }
  return saida;
}

// ------------------------------------------------------------- cálculo

export function montarProposta(cfg: ConfigProposta): Proposta {
  const fator = PORTES[cfg.porte].fator * FORMALIZACOES[cfg.formalizacao].fator;
  const avisos: string[] = [];

  const escolhidos = CATALOGO.filter((s) => cfg.marcacoes[s.id]);

  let baseUnica = 0;
  let baseMensal = 0;
  let custoUnico = 0;
  let custoMensal = 0;

  for (const s of escolhidos) {
    if (s.mensal) {
      baseMensal += s.preco;
      custoMensal += s.custo;
    } else {
      baseUnica += s.preco;
      custoUnico += s.custo;
    }
  }

  let entrada = baseUnica * fator;
  let mensalidade = baseMensal * fator;

  if (cfg.desconto) {
    entrada *= 1 - cfg.desconto / 100;
    mensalidade *= 1 - cfg.desconto / 100;
  }

  const teto = tetoDoPorte(cfg.porte);

  if (entrada > 0 && entrada < PISO_ABSOLUTO) {
    avisos.push(
      `Ficou abaixo do piso de ${moeda(PISO_ABSOLUTO)}; ajustei para o piso.` +
        (cfg.desconto ? ' O desconto que você deu não cabe neste escopo.' : ''),
    );
    entrada = PISO_ABSOLUTO;
  } else if (entrada > 0 && entrada < ALVO_MINIMO) {
    avisos.push(`Abaixo dos ${moeda(ALVO_MINIMO)} que você quer como mínimo. Vale incluir mais um item.`);
  }

  if (entrada > teto) {
    if (cfg.ignorarTeto) {
      avisos.push(
        `Acima do teto de ${moeda(teto)} deste porte, mas o teto está liberado. ` +
          'Confira se o cliente comporta esse valor.',
      );
    } else {
      const antes = entrada;
      entrada = teto;
      avisos.push(
        `Cortei de ${moeda(arredondar(antes))} para o teto de ${moeda(teto)} deste porte. ` +
          'Se o escopo é grande mesmo, libere o teto aqui embaixo.',
      );
    }
  }

  entrada = entrada > 0 ? arredondar(entrada) : 0;
  mensalidade = arredondarMensal(mensalidade);

  const margemEntrada = entrada - custoUnico;
  if (entrada > 0 && margemEntrada < 200) {
    avisos.push('Sobra pouco depois dos custos. Confira se compensa.');
  }

  /*
   * Desconto grande merece ser dito em reais, não em porcentagem. "30%"
   * não dói; "você está deixando R$ 420 na mesa" dói — e é o número que
   * faz a pessoa pensar duas vezes antes de fechar por fechar.
   */
  if (cfg.desconto && cfg.desconto >= 25 && entrada > 0) {
    const cheio = arredondar(entrada / (1 - cfg.desconto / 100));
    avisos.push(
      `Desconto de ${cfg.desconto}%: são ${moeda(cheio - entrada)} a menos do que a proposta cheia. ` +
        'Cobre alguma contrapartida — pagamento à vista, indicação, depoimento.',
    );
  }

  return {
    itens: escolhidos.map((s) => ({
      id: s.id,
      nome: s.nome,
      beneficio: s.beneficio,
      mensal: !!s.mensal,
      brinde: !!s.brinde,
    })),
    entrada,
    mensalidade,
    custoUnico,
    custoMensal,
    margemEntrada,
    avisos,
  };
}

// -------------------------------------------------- texto para enviar

export function textoDaProposta(nomeCliente: string, p: Proposta, previaUrl?: string | null): string {
  const linhas: string[] = [];
  linhas.push(`*Proposta — ${nomeCliente}*`);
  linhas.push('');

  const rotulo = (i: ItemDaProposta) => `• ${i.nome}${i.brinde ? ' _(incluso)_' : ''}`;

  for (const i of p.itens.filter((x) => !x.mensal)) linhas.push(rotulo(i));

  const mensais = p.itens.filter((x) => x.mensal);
  if (mensais.length) {
    linhas.push('');
    linhas.push('_Acompanhamento mensal:_');
    for (const i of mensais) linhas.push(rotulo(i));
  }

  linhas.push('');
  if (p.entrada > 0) linhas.push(`Investimento: *${moeda(p.entrada)}*`);
  if (p.mensalidade > 0) linhas.push(`Mensalidade: *${moeda(p.mensalidade)}/mês*`);
  if (previaUrl) {
    linhas.push('');
    linhas.push('Veja a prévia do seu site:');
    linhas.push(previaUrl);
  }

  linhas.push('');
  linhas.push('Domínio próprio e certificado de segurança já inclusos.');
  linhas.push('Qualquer dúvida, é só chamar.');

  return linhas.join('\n');
}
