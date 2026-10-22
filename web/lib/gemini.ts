/**
 * A "cabeça" do robô de vendas: o Google Gemini pela API (generateContent).
 * Só o servidor fala com o Google; a chave (GEMINI_API_KEY) nunca vai para
 * o navegador.
 *
 * Na faixa grátis o Google pode usar o que é enviado para melhorar os
 * produtos dele e pede para não mandar dado pessoal: por isso o robô manda
 * só o nome do comércio, o ramo, a cidade e a conversa, nunca telefone ou
 * e-mail. Ligar o faturamento no projeto do Google (mesma chave) tira esse
 * uso.
 *
 * Variáveis na Vercel (só servidor):
 *   GEMINI_API_KEY   a chave criada em aistudio.google.com
 *   GEMINI_MODELO    opcional; padrão gemini-3.8-flash
 *   GEMINI_URL       opcional; só para teste local com um servidor falso
 */

export function geminiLigado(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function modeloGemini(): string {
  return process.env.GEMINI_MODELO || 'gemini-3.8-flash';
}

export class ErroGemini extends Error {
  constructor(msg: string, public tipo: 'chave' | 'limite' | 'recusa' | 'falha') {
    super(msg);
  }
}

export interface RespostaGemini<T> {
  dados: T;
  entrada: number;
  saida: number;
  modelo: string;
}

/** pede uma resposta em JSON no formato do esquema; erro vira ErroGemini com o motivo em português */
export async function perguntarJson<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  if (!geminiLigado()) throw new ErroGemini('Falta a chave do Gemini (GEMINI_API_KEY) na Vercel.', 'chave');
  const modelo = modeloGemini();
  const base = (process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

  let r: Response;
  try {
    r = await fetch(`${base}/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucoes }] },
        contents: [{ role: 'user', parts: [{ text: pedido }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: esquema,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
  } catch {
    throw new ErroGemini('O Gemini não respondeu a tempo.', 'falha');
  }

  const texto = await r.text();
  if (!r.ok) {
    console.error('[gemini]', r.status, texto.slice(0, 400));
    if (r.status === 400 && /API key/i.test(texto)) throw new ErroGemini('A chave do Gemini foi recusada. Confira a GEMINI_API_KEY na Vercel.', 'chave');
    if (r.status === 401 || r.status === 403) throw new ErroGemini('A chave do Gemini foi recusada. Confira a GEMINI_API_KEY na Vercel.', 'chave');
    if (r.status === 429) throw new ErroGemini('O Gemini atingiu o limite de uso (da faixa grátis, por minuto ou por dia).', 'limite');
    throw new ErroGemini('O Gemini recusou o pedido.', 'falha');
  }

  const j = JSON.parse(texto) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    modelVersion?: string;
  };
  const c = j.candidates?.[0];
  if (!c || j.promptFeedback?.blockReason || c.finishReason === 'SAFETY' || c.finishReason === 'PROHIBITED_CONTENT') {
    throw new ErroGemini('O Gemini não quis responder esta conversa.', 'recusa');
  }
  const saida = (c.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  let dados: T;
  try {
    dados = JSON.parse(saida) as T;
  } catch {
    throw new ErroGemini(c.finishReason === 'MAX_TOKENS' ? 'A resposta do Gemini veio cortada.' : 'O Gemini respondeu num formato errado.', 'falha');
  }
  const u = j.usageMetadata || {};
  return {
    dados,
    entrada: u.promptTokenCount || 0,
    saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
    modelo: j.modelVersion || modelo,
  };
}
