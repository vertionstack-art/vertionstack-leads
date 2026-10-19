/**
 * A sugestão da próxima mensagem, nos dois modos da conversa guiada: vinda
 * da API do Claude (lib/ia) ou colada de volta do chat do claude.ai. Roda no
 * navegador e no servidor.
 */

import { OBJECOES, TODOS_OS_PASSOS } from './roteiro';

export const SITUACOES = ['atendente', 'decisor', 'interessado', 'objecao', 'sem_resposta', 'recusou', 'fechou', 'outro'] as const;

export interface Sugestao {
  leitura: string;
  situacao: (typeof SITUACOES)[number];
  passo: string;
  objecao: string;
  mensagem: string;
  alternativa: string;
  proximo: string;
}

/**
 * Lê o que a pessoa colou de volta do claude.ai: o JSON pedido (mesmo com
 * cercas de código ou texto em volta). Se não achar JSON, o texto inteiro
 * vira a mensagem sugerida.
 */
export function lerRespostaColada(texto: string): Sugestao {
  const vazio: Sugestao = { leitura: '', situacao: 'outro', passo: '', objecao: '', mensagem: '', alternativa: '', proximo: '' };
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio >= 0 && fim > inicio) {
    try {
      const j = JSON.parse(texto.slice(inicio, fim + 1)) as Partial<Sugestao>;
      const s: Sugestao = { ...vazio };
      for (const k of Object.keys(vazio) as (keyof Sugestao)[]) {
        if (typeof j[k] === 'string') (s as unknown as Record<string, string>)[k] = (j[k] as string).slice(0, 2000);
      }
      if (!SITUACOES.includes(s.situacao)) s.situacao = 'outro';
      if (!TODOS_OS_PASSOS.some((p) => p.id === s.passo)) s.passo = '';
      if (!OBJECOES.some((o) => o.id === s.objecao)) s.objecao = '';
      if (s.mensagem) return s;
    } catch {
      // não era JSON: cai no texto puro abaixo
    }
  }
  return { ...vazio, mensagem: texto.trim().slice(0, 2000) };
}
