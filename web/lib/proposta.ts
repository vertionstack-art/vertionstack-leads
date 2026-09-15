/**
 * Monta as três propostas a partir do que foi marcado.
 *
 * Os planos são cumulativos: cada serviço é marcado com o plano em que
 * *entra*, e continua valendo nos de cima. Marcar "landing page" como
 * básico significa que ela está nos três; marcar "agendamento" como
 * avançado significa que só o avançado tem.
 *
 * Sobre os limites: o piso não é preferência, é sobrevivência — abaixo
 * dele o trabalho sai de graça ou no prejuízo. O teto é o contrário: um
 * número que impede pedir demais para quem não pode pagar, e que sobe
 * junto com o porte do cliente, porque cobrar de uma rede o mesmo que de
 * uma barbearia de uma cadeira é deixar dinheiro na mesa.
 */

import {
  CATALOGO,
  PORTES,
  FORMALIZACOES,
  porId,
  type Porte,
  type Formalizacao,
} from './catalogo';

export type Nivel = 'basico' | 'intermediario' | 'avancado';

export const NIVEIS: Nivel[] = ['basico', 'intermediario', 'avancado'];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  basico: 'Essencial',
  intermediario: 'Completo',
  avancado: 'Premium',
};

/** o que o vendedor marcou: id do serviço -> plano em que ele entra */
export type Marcacoes = Record<string, Nivel | undefined>;

export interface ConfigProposta {
  marcacoes: Marcacoes;
  porte: Porte;
  formalizacao: Formalizacao;
  /** desconto manual em % aplicado no fim, se o vendedor quiser */
  desconto?: number;
  /**
   * Solta o teto do porte. Serve para escopo que é grande de verdade —
   * uma landing somada a uma loja virtual custa mais mesmo, e nesse caso
   * o teto estaria escondendo o preço certo em vez de proteger o cliente.
   */
  ignorarTeto?: boolean;
}

export interface ItemDoPlano {
  id: string;
  nome: string;
  beneficio: string;
  mensal: boolean;
}

export interface Plano {
  nivel: Nivel;
  rotulo: string;
  itens: ItemDoPlano[];
  /** valor de entrada, cobrado uma vez */
  entrada: number;
  /** valor por mês */
  mensalidade: number;
  /** o que sai do seu bolso: uma vez e por mês */
  custoUnico: number;
  custoMensal: number;
  /** quanto sobra da entrada depois dos custos */
  margemEntrada: number;
  avisos: string[];
}

// ------------------------------------------------------------ limites

/** abaixo disto o projeto não se paga */
export const PISO_ABSOLUTO = 387.45;
/** onde o plano de entrada deveria chegar */
export const ALVO_MINIMO = 500;
/** teto do plano premium para um cliente micro; sobe com o porte */
export const TETO_BASE = 1200;

const ordem: Record<Nivel, number> = { basico: 0, intermediario: 1, avancado: 2 };

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

// ------------------------------------------------------------- cálculo

function montarPlano(nivel: Nivel, cfg: ConfigProposta): Plano {
  const fator = PORTES[cfg.porte].fator * FORMALIZACOES[cfg.formalizacao].fator;
  const avisos: string[] = [];

  const escolhidos = CATALOGO.filter((s) => {
    const marcado = cfg.marcacoes[s.id];
    return marcado !== undefined && ordem[marcado] <= ordem[nivel];
  });

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

  // o domínio é anual: para a conta de entrada, vale o primeiro ano
  let entrada = baseUnica * fator;
  let mensalidade = baseMensal * fator;

  if (cfg.desconto) {
    entrada *= 1 - cfg.desconto / 100;
    mensalidade *= 1 - cfg.desconto / 100;
  }

  if (entrada > 0 && entrada < PISO_ABSOLUTO) {
    avisos.push(`Ficou abaixo do piso de ${moeda(PISO_ABSOLUTO)}; ajustei para o piso.`);
    entrada = PISO_ABSOLUTO;
  } else if (entrada > 0 && entrada < ALVO_MINIMO) {
    avisos.push(`Abaixo dos ${moeda(ALVO_MINIMO)} que você quer como mínimo. Vale incluir mais um item.`);
  }

  entrada = entrada > 0 ? arredondar(entrada) : 0;
  mensalidade = arredondarMensal(mensalidade);

  if (entrada > 0 && entrada - custoUnico < 200) {
    avisos.push('Sobra pouco depois dos custos. Confira se compensa.');
  }

  return {
    nivel,
    rotulo: ROTULO_NIVEL[nivel],
    itens: escolhidos.map((s) => ({
      id: s.id,
      nome: s.nome,
      beneficio: s.beneficio,
      mensal: !!s.mensal,
    })),
    entrada,
    mensalidade,
    custoUnico,
    custoMensal,
    margemEntrada: entrada - custoUnico,
    avisos,
  };
}

/**
 * O teto precisa ser respeitado de verdade, não só avisado.
 *
 * Corta só quem passou do limite. A primeira versão encolhia os três na
 * mesma proporção, e isso produzia um absurdo: marcar MEI, que dá desconto,
 * deixava o plano de entrada MAIS caro — porque com a base menor o premium
 * chegava mais perto do teto, era comprimido menos, e a compressão menor
 * subia os outros junto. Teto é limite de quem estoura, não régua geral.
 */
export function montarPropostas(cfg: ConfigProposta): Plano[] {
  const planos = NIVEIS.map((n) => montarPlano(n, cfg));
  const teto = tetoDoPorte(cfg.porte);

  for (const p of planos) {
    if (p.entrada <= teto) continue;

    if (cfg.ignorarTeto) {
      p.avisos.push(
        `Acima do teto de ${moeda(teto)} deste porte, mas o teto está liberado. ` +
          'Confira se o cliente comporta esse valor.',
      );
      continue;
    }

    const antes = p.entrada;
    p.entrada = Math.max(PISO_ABSOLUTO, arredondar(teto));
    p.margemEntrada = p.entrada - p.custoUnico;
    p.avisos.push(
      `Cortei de ${moeda(antes)} para o teto de ${moeda(teto)} deste porte. ` +
        'Se o escopo é grande mesmo, libere o teto aqui embaixo.',
    );
  }

  // a escada precisa subir: nunca um plano maior custando igual ou menos.
  // Quando o teto achatou dois planos no mesmo valor, o de baixo é que cede.
  for (let i = planos.length - 1; i > 0; i--) {
    const atual = planos[i];
    const anterior = planos[i - 1];
    if (atual.entrada > 0 && anterior.entrada >= atual.entrada) {
      anterior.entrada = arredondar(atual.entrada * 0.82);
      anterior.margemEntrada = anterior.entrada - anterior.custoUnico;
    }
  }

  for (const p of planos) {
    if (p.entrada > 0 && p.margemEntrada < 200 && !p.avisos.some((a) => a.startsWith('Sobra pouco'))) {
      p.avisos.push('Sobra pouco depois dos custos. Confira se compensa.');
    }
  }

  return planos;
}

export function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// -------------------------------------------------- texto para enviar

export function textoDaProposta(nomeCliente: string, planos: Plano[]): string {
  const linhas: string[] = [];
  linhas.push(`*Proposta — ${nomeCliente}*`);
  linhas.push('');

  for (const p of planos) {
    if (!p.itens.length) continue;

    linhas.push(`*${p.rotulo.toUpperCase()}*`);
    for (const i of p.itens.filter((x) => !x.mensal)) linhas.push(`• ${i.nome}`);

    const mensais = p.itens.filter((x) => x.mensal);
    if (mensais.length) {
      linhas.push('');
      linhas.push('_Acompanhamento mensal:_');
      for (const i of mensais) linhas.push(`• ${i.nome}`);
    }

    linhas.push('');
    if (p.entrada > 0) linhas.push(`Investimento: *${moeda(p.entrada)}*`);
    if (p.mensalidade > 0) linhas.push(`Mensalidade: *${moeda(p.mensalidade)}/mês*`);
    linhas.push('');
    linhas.push('—');
    linhas.push('');
  }

  linhas.push('Domínio próprio e certificado de segurança já inclusos.');
  linhas.push('Qualquer dúvida, é só chamar.');

  return linhas.join('\n');
}
