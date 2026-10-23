/**
 * O que a tela precisa saber do robô de vendas (lib/robo roda só no
 * servidor). Roda no navegador e no servidor.
 */

export type Aguardando = 'previa' | 'proposta' | 'preco' | 'humano';

export const ROTULO_AGUARDANDO: Record<string, string> = {
  previa: 'Mandar a prévia',
  proposta: 'Mandar a proposta',
  preco: 'Negociar valor',
  humano: 'Precisa de você',
  encerrou: 'O cliente pediu para parar',
};

export interface EstadoRobo {
  /** o interruptor geral da conta */
  ativoNaConta: boolean;
  /** a IA do robô (PC ou Gemini) e o WhatsApp estão configurados na Vercel */
  pronto: boolean;
  ligado: boolean;
  aguardando: Aguardando | null;
  aguardandoMotivo: string | null;
  aguardandoDesde: string | null;
  pausadoMotivo: string | null;
  respostasHoje: number;
  /** o lead chamou o WhatsApp da Vertion por conta própria (lib/entrada) */
  chamouPrimeiro: boolean;
}

export interface AvisoRobo {
  id: number;
  leadId: string;
  nome: string;
  tipo: string;
  texto: string;
  em: string;
}
