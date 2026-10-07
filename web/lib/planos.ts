/**
 * Os planos e o que cada um libera. Fonte única: o servidor usa para travar
 * e a página de Planos usa para mostrar — os números não podem divergir.
 *
 * Coletar leads não custa nada ao servidor (quem varre o Maps é a extensão,
 * no computador do cliente). O que custa é guardar e conferir os sites,
 * então o limite é de leads NOVOS por semana, mais um teto de guardados.
 * Decididos com o Lucas em 03/10/2026.
 */

export type Plano = 'gratis' | 'basic' | 'pro' | 'cortesia';

export interface Limites {
  /**
   * Leads novos por semana (segunda a domingo, horário de Brasília).
   * No Free é o total do teste grátis, que não renova (decidido em 07/10/2026).
   */
  semana: number;
  /** quantos leads a conta pode ter guardados ao mesmo tempo */
  guardados: number;
  /** pessoas dividindo a mesma conta */
  pessoas: number;
  /** computadores por chave da extensão */
  aparelhos: number;
  /** funis no CRM */
  funis: number;
}

export const LIMITES: Record<Plano, Limites> = {
  gratis: { semana: 30, guardados: 200, pessoas: 1, aparelhos: 2, funis: 1 },
  basic: { semana: 150, guardados: 3000, pessoas: 1, aparelhos: 2, funis: 5 },
  pro: { semana: 500, guardados: 15000, pessoas: 3, aparelhos: 3, funis: 20 },
  // a conta da própria Vertion: sem teto prático
  cortesia: { semana: 1_000_000, guardados: 1_000_000, pessoas: 20, aparelhos: 10, funis: 50 },
};

export interface InfoPlano {
  plano: Exclude<Plano, 'cortesia'>;
  nome: string;
  /** em centavos; zero no grátis */
  precoCentavos: number;
  resumo: string;
}

export const PLANOS_A_VENDA: InfoPlano[] = [
  { plano: 'gratis', nome: 'Teste grátis', precoCentavos: 0, resumo: 'Para conhecer a ferramenta, sem cartão.' },
  { plano: 'basic', nome: 'Basic', precoCentavos: 3790, resumo: 'Para o freelancer que prospecta sozinho.' },
  { plano: 'pro', nome: 'Pro', precoCentavos: 6790, resumo: 'Para quem prospecta pesado ou trabalha em dupla.' },
];

export const NOME_DO_PLANO: Record<Plano, string> = { gratis: 'Teste grátis', basic: 'Basic', pro: 'Pro', cortesia: 'Cortesia' };

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
