/**
 * Os planos e o que cada um libera. Fonte única: o servidor usa para travar
 * e a página de Planos usa para mostrar — os números não podem divergir.
 *
 * O que custa dinheiro é a busca no Google (Places API): cada chamada traz até
 * 20 comércios e é cobrada mesmo que nenhum vire lead. Por isso cada plano tem
 * um teto de BUSCAS, além do teto de leads. Com estes números, mesmo depois da
 * faixa grátis do Google cada assinante custa uma fração do que paga — e,
 * enquanto a ferramenta inteira ficar abaixo de 1.000 buscas por mês, custa
 * zero (o Lucas quer gastar o mínimo possível; decidido em 10/10/2026).
 */

export type Plano = 'gratis' | 'semanal' | 'basic' | 'pro' | 'cortesia';

export interface Limites {
  /**
   * Leads novos por semana (segunda a domingo, horário de Brasília).
   * No teste grátis é o total, que não renova (decidido em 07/10/2026).
   */
  semana: number;
  /**
   * Buscas no Google. Teste: no total. 7 dias: durante os 7 dias pagos.
   * Basic e Pro: por mês.
   */
  buscas: number;
  /** quantos leads a conta pode ter guardados ao mesmo tempo */
  guardados: number;
  /** pessoas na mesma conta: 1 em todo plano à venda (o Lucas não quer equipe, 10/10/2026); só a cortesia junta gente pela central */
  pessoas: number;
  /** computadores por chave da extensão */
  aparelhos: number;
  /** funis no CRM */
  funis: number;
}

export const LIMITES: Record<Plano, Limites> = {
  gratis: { semana: 30, buscas: 10, guardados: 200, pessoas: 1, aparelhos: 2, funis: 1 },
  semanal: { semana: 100, buscas: 25, guardados: 1000, pessoas: 1, aparelhos: 1, funis: 2 },
  basic: { semana: 150, buscas: 60, guardados: 3000, pessoas: 1, aparelhos: 2, funis: 5 },
  pro: { semana: 500, buscas: 120, guardados: 15000, pessoas: 1, aparelhos: 3, funis: 20 },
  // a conta da própria Vertion: sem teto prático
  cortesia: { semana: 1_000_000, buscas: 1_000_000, guardados: 1_000_000, pessoas: 20, aparelhos: 10, funis: 50 },
};

/** dias que um pagamento avulso libera: o de 7 dias, ou um mês no Pix */
export const DIAS_DO_PLANO: Record<'semanal' | 'basic' | 'pro', number> = { semanal: 7, basic: 31, pro: 31 };

export interface InfoPlano {
  plano: Exclude<Plano, 'cortesia'>;
  nome: string;
  /** em centavos; zero no grátis */
  precoCentavos: number;
  /** "/mês", "/7 dias" */
  periodo: string;
  resumo: string;
}

export const PLANOS_A_VENDA: InfoPlano[] = [
  { plano: 'gratis', nome: 'Teste grátis', precoCentavos: 0, periodo: '', resumo: 'Para conhecer a ferramenta, sem cartão.' },
  { plano: 'semanal', nome: '7 dias', precoCentavos: 1490, periodo: '/7 dias', resumo: 'Uma semana inteira de prospecção, sem assinatura.' },
  { plano: 'basic', nome: 'Basic', precoCentavos: 3790, periodo: '/mês', resumo: 'Para o freelancer que prospecta sozinho.' },
  { plano: 'pro', nome: 'Pro', precoCentavos: 6790, periodo: '/mês', resumo: 'Para quem prospecta pesado, todo dia.' },
];

export const NOME_DO_PLANO: Record<Plano, string> = {
  gratis: 'Teste grátis',
  semanal: '7 dias',
  basic: 'Basic',
  pro: 'Pro',
  cortesia: 'Cortesia',
};

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
