/**
 * A IA que roda no PC do dono (Ollama, na placa de vídeo), 100% grátis e
 * privada: nada da conversa vai para empresa nenhuma. Fica atrás da
 * "portaria" do PC (nginx no Docker), que só deixa passar /ia/api/chat com a
 * senha no cabeçalho x-vertion-ia; o acesso de fora é o mesmo túnel do ngrok
 * do WhatsApp. Só o servidor fala com ela.
 *
 * Variáveis na Vercel (só servidor):
 *   OLLAMA_URL      https://<domínio do ngrok>/ia
 *   OLLAMA_SEGREDO  a senha da portaria (IA_SEGREDO no .env do PC)
 *   OLLAMA_MODELO   opcional; padrão gemma4:12b
 */

import { ErroGemini, type RespostaGemini } from './gemini';
import { groqLigado } from './groq';

export function iaLocalLigada(): boolean {
  return Boolean(process.env.OLLAMA_URL && process.env.OLLAMA_SEGREDO);
}

export function modeloLocal(): string {
  return process.env.OLLAMA_MODELO || 'gemma4:12b';
}

/** o mesmo do OLLAMA_CONTEXT_LENGTH do docker-compose: pedir outro tamanho faz o Ollama recarregar o modelo */
const CONTEXTO = 10240;

function cabecalhos(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-vertion-ia': (process.env.OLLAMA_SEGREDO || '').trim(),
    // o ngrok grátis mostra uma página de aviso para navegador; servidor pula com isto
    'ngrok-skip-browser-warning': '1',
  };
}

/**
 * Carrega o modelo na placa de vídeo sem pedir resposta (o Ollama aceita
 * conversa vazia para isso). O webhook chama quando o cliente escreve: a
 * carga, que leva uns 50 s depois de 30 min parada, acontece enquanto o robô
 * espera o cliente terminar de digitar. Falhar aqui não importa.
 */
export async function aquecerIaLocal(): Promise<void> {
  // com o Groq ligado a IA do PC não é usada: não carrega a placa à toa
  if (!iaLocalLigada() || groqLigado()) return;
  const base = (process.env.OLLAMA_URL || '').trim().replace(/\/$/, '');
  try {
    await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: cabecalhos(),
      body: JSON.stringify({ model: modeloLocal(), messages: [], keep_alive: '30m', options: { num_ctx: CONTEXTO } }),
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
    });
  } catch {
    // sem problema: a resposta de verdade tenta de novo
  }
}

export async function perguntarJsonLocal<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  const base = (process.env.OLLAMA_URL || '').trim().replace(/\/$/, '');
  const modelo = modeloLocal();

  let r: Response;
  try {
    r = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: cabecalhos(),
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: instrucoes },
          { role: 'user', content: pedido },
        ],
        stream: false,
        // o Ollama obriga a resposta a seguir o esquema
        format: esquema,
        think: false,
        keep_alive: '30m',
        options: { temperature: 0.7, num_ctx: CONTEXTO, num_predict: 1024 },
      }),
      // a primeira resposta depois de um tempo parado carrega o modelo na placa (uns segundos a mais)
      signal: AbortSignal.timeout(100_000),
      cache: 'no-store',
    });
  } catch {
    throw new ErroGemini('A IA do seu PC não respondeu a tempo. O PC está ligado e o Docker aberto?', 'falha');
  }

  const texto = await r.text();
  if (!r.ok) {
    console.error('[ia-local]', r.status, texto.slice(0, 300));
    if (r.status === 401) throw new ErroGemini('A portaria do PC recusou a senha. Confira a OLLAMA_SEGREDO na Vercel (é a IA_SEGREDO do .env do PC).', 'chave');
    if (/ERR_NGROK|tunnel.*not found|endpoint.*offline/i.test(texto) || r.status === 404) {
      throw new ErroGemini('O túnel do PC está desligado. O PC está ligado e o ngrok rodando?', 'falha');
    }
    if (r.status >= 500) throw new ErroGemini('A IA do seu PC está fora do ar. Abra o Docker Desktop e espere uns minutos.', 'falha');
    throw new ErroGemini(`A IA do seu PC recusou o pedido (${r.status}).`, 'falha');
  }

  const j = JSON.parse(texto) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number; done_reason?: string; model?: string };
  const saida = j.message?.content || '';
  let dados: T;
  try {
    const ini = saida.indexOf('{');
    const fim = saida.lastIndexOf('}');
    dados = JSON.parse(ini >= 0 && fim > ini ? saida.slice(ini, fim + 1) : saida) as T;
  } catch {
    throw new ErroGemini(j.done_reason === 'length' ? 'A resposta da IA veio cortada.' : 'A IA respondeu num formato errado.', 'falha');
  }
  return {
    dados,
    entrada: j.prompt_eval_count || 0,
    saida: j.eval_count || 0,
    modelo: `pc:${j.model || modelo}`,
  };
}
