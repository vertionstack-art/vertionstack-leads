/**
 * O que a tela e o servidor compartilham do copiloto comercial (lib/copiloto):
 * as tarefas, os tons e o formato da resposta. Roda no navegador e no servidor.
 */

export const TAREFAS = ['abordagem', 'resposta', 'followup', 'audio', 'email', 'proximo_passo'] as const;
export type Tarefa = (typeof TAREFAS)[number];

export const ROTULO_TAREFA: Record<Tarefa, string> = {
  abordagem: 'Abordagem',
  resposta: 'Responder',
  followup: 'Follow-up',
  audio: 'Roteiro de áudio',
  email: 'E-mail',
  proximo_passo: 'Próximo passo',
};

export const TONS = ['padrao', 'direto', 'leve', 'curto', 'formal'] as const;
export type Tom = (typeof TONS)[number];

export const ROTULO_TOM: Record<Tom, string> = {
  padrao: 'Seu jeito',
  direto: 'Mais direto',
  leve: 'Mais leve',
  curto: 'Mais curto',
  formal: 'Mais formal',
};

export const ACOES_COPILOTO = ['escrever', 'aguardar', 'encerrar', 'confirmar_com_voce'] as const;
export type AcaoCopiloto = (typeof ACOES_COPILOTO)[number];

export interface RespostaCopiloto {
  leitura: string;
  objetivo: string;
  estrategia: string;
  acao: AcaoCopiloto;
  mensagem: string;
  assunto: string;
  alternativa: string;
  por_que: string;
  proximo_passo: string;
  precisa_confirmar: string;
}

export const ROTULO_ACAO: Record<AcaoCopiloto, string> = {
  escrever: 'Pronta para revisar',
  aguardar: 'Melhor aguardar',
  encerrar: 'Melhor encerrar',
  confirmar_com_voce: 'Confirme antes de mandar',
};
