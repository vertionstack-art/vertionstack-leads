/**
 * A "cabeça" do robô de vendas: a IA do PC do dono (lib/ia-local) quando ela
 * está configurada na Vercel, senão o Gemini (lib/gemini). O resto do robô
 * não sabe qual das duas respondeu.
 */

import { ErroGemini, geminiLigado, perguntarJson as perguntarGemini, type RespostaGemini } from './gemini';
import { iaLocalLigada, perguntarJsonLocal } from './ia-local';

export { ErroGemini as ErroIa };

export function cabecaLigada(): boolean {
  return iaLocalLigada() || geminiLigado();
}

export const FALTA_CABECA = 'Falta configurar a IA do robô na Vercel (OLLAMA_URL e OLLAMA_SEGREDO, ou GEMINI_API_KEY).';

export function perguntarJson<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  return iaLocalLigada() ? perguntarJsonLocal<T>(instrucoes, pedido, esquema) : perguntarGemini<T>(instrucoes, pedido, esquema);
}
