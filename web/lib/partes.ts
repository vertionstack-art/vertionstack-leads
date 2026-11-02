/**
 * A primeira mensagem vai picada, como gente escreve no WhatsApp: "Oi, tudo
 * bem?" numa, a apresentação na outra, o motivo e a pergunta na última. No
 * texto, cada parte fica separada por uma linha em branco.
 *
 * Roda no navegador (para mostrar "vai em 3 mensagens") e no servidor (para
 * mandar uma por uma).
 */

export const MAX_PARTES = 3;

/** separa pelas linhas em branco; o que passar de 3 partes junta na última */
export function partesDaMensagem(texto: string, max = MAX_PARTES): string[] {
  const partes = texto
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length <= max) return partes;
  return [...partes.slice(0, max - 1), partes.slice(max - 1).join('\n\n')];
}

/** quanto tempo o WhatsApp mostra "digitando..." antes de cada parte (ms) */
export function tempoDigitando(parte: string, indice: number): number {
  if (indice === 0) return 900;
  return Math.min(4500, 1200 + parte.length * 28);
}
