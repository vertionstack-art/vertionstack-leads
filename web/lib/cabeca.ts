/**
 * A "cabeça" do robô de vendas e do copiloto: qual IA responde.
 *
 * Com o Groq configurado (lib/groq), ele é a primeira opção, e o Gemini
 * (lib/gemini) entra só quando os modelos do Groq estão no limite ou fora
 * do ar. A IA do PC (lib/ia-local) só é usada quando não há Groq: a placa
 * de vídeo do PC travou com a IA rodando (23/10/2026), então ela não entra
 * nem como reserva. O resto do sistema não sabe qual respondeu.
 */

import { ErroGemini, geminiLigado, perguntarJson as perguntarGemini, type RespostaGemini } from './gemini';
import { iaLocalLigada, perguntarJsonLocal } from './ia-local';
import { groqLigado, perguntarJsonGroq } from './groq';

export { ErroGemini as ErroIa };

export function cabecaLigada(): boolean {
  return groqLigado() || iaLocalLigada() || geminiLigado();
}

export const FALTA_CABECA = 'Falta configurar a IA do robô na Vercel (GROQ_API_KEY, ou GEMINI_API_KEY).';

export async function perguntarJson<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  if (groqLigado()) {
    try {
      return await perguntarJsonGroq<T>(instrucoes, pedido, esquema);
    } catch (e) {
      // chave errada não se resolve trocando de IA: o dono precisa ver o aviso
      if (!(e instanceof ErroGemini) || e.tipo === 'chave' || !geminiLigado()) throw e;
      return perguntarGemini<T>(instrucoes, pedido, esquema);
    }
  }
  return iaLocalLigada() ? perguntarJsonLocal<T>(instrucoes, pedido, esquema) : perguntarGemini<T>(instrucoes, pedido, esquema);
}
