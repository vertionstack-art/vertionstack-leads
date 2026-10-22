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

/** a chave como foi colada na Vercel, sem espaço, quebra de linha ou aspas em volta (o erro mais comum ao colar) */
function chave(): string {
  return (process.env.GEMINI_API_KEY || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

export function geminiLigado(): boolean {
  return Boolean(chave());
}

/**
 * Traduz a recusa do Google no motivo e no que fazer. O motivo vem no corpo
 * do erro (error.status e error.details[].reason); a chave nunca aparece.
 */
function erroDoGoogle(status: number, corpo: string, modelo: string): ErroGemini {
  let motivo = '';
  let mensagem = '';
  try {
    const e = (JSON.parse(corpo) as { error?: { status?: string; message?: string; details?: { reason?: string }[] } }).error || {};
    motivo = [e.status, ...(e.details || []).map((d) => d.reason)].filter(Boolean).join(' ');
    mensagem = e.message || '';
  } catch {
    mensagem = corpo;
  }
  const tudo = `${motivo} ${mensagem}`;
  const comCodigo = (t: string) => `${t} (Google: ${motivo || status})`;

  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(tudo)) {
    return new ErroGemini(comCodigo('O Google diz que a chave não é válida: ela foi copiada errada, pela metade ou foi apagada. Copie de novo em aistudio.google.com (Get API key), cole na GEMINI_API_KEY da Vercel e publique de novo.'), 'chave');
  }
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(tudo)) {
    return new ErroGemini(comCodigo('A chave é de um projeto do Google em que o Gemini não está ativado. Crie a chave pelo aistudio.google.com (ele já ativa tudo) em vez do Google Cloud.'), 'chave');
  }
  if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|blocked/i.test(tudo)) {
    return new ErroGemini(comCodigo('A chave tem uma restrição que bloqueia o Gemini (site, IP ou serviço). Crie uma chave nova no aistudio.google.com, sem restrições.'), 'chave');
  }
  if (/location is not supported|FAILED_PRECONDITION/i.test(tudo)) {
    return new ErroGemini(comCodigo('O Google não liberou o Gemini grátis para a região de onde o pedido saiu.'), 'chave');
  }
  if (status === 404 || /NOT_FOUND|is not found/i.test(tudo)) {
    return new ErroGemini(comCodigo(`O modelo ${modelo} não está disponível para esta chave.`), 'falha');
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(tudo)) {
    return new ErroGemini(comCodigo('O Gemini atingiu o limite de uso da faixa grátis (por minuto ou por dia). Espere um pouco.'), 'limite');
  }
  if (status === 401 || status === 403 || /PERMISSION_DENIED|UNAUTHENTICATED/i.test(tudo)) {
    return new ErroGemini(comCodigo('O Google recusou a chave.'), 'chave');
  }
  return new ErroGemini(comCodigo(`O Gemini recusou o pedido${mensagem ? `: ${mensagem.slice(0, 160)}` : ''}.`), 'falha');
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

/** o Google já recusou o formato completo nesta instância: vai direto no simples */
let formatoSimples = false;

/** pede uma resposta em JSON no formato do esquema; erro vira ErroGemini com o motivo em português */
export async function perguntarJson<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  if (!geminiLigado()) throw new ErroGemini('Falta a chave do Gemini (GEMINI_API_KEY) na Vercel.', 'chave');
  const modelo = modeloGemini();
  const base = (process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');

  /*
   * Primeiro o pedido completo (esquema de JSON e raciocínio curto). Se o
   * Google recusar o formato (400 que não é de chave), repete na hora no
   * formato simples, que todo modelo aceita: só "responda em JSON", com o
   * esquema escrito nas instruções. Depois de uma recusa, esta instância já
   * vai direto no simples.
   */
  const enviar = (simples: boolean) =>
    fetch(`${base}/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave() },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: simples ? `${instrucoes}\n\nResponda SOMENTE com um objeto JSON válido que siga este JSON Schema, sem texto antes ou depois:\n${JSON.stringify(esquema)}` : instrucoes }],
        },
        contents: [{ role: 'user', parts: [{ text: pedido }] }],
        generationConfig: simples
          ? { responseMimeType: 'application/json', maxOutputTokens: 4096 }
          : { responseMimeType: 'application/json', responseJsonSchema: esquema, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'low' } },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });

  let r: Response;
  let texto: string;
  try {
    r = await enviar(formatoSimples);
    texto = await r.text();
    if (r.status === 400 && !formatoSimples && !/API_KEY|API key/i.test(texto)) {
      console.error('[gemini] formato completo recusado, tentando o simples:', texto.slice(0, 600));
      formatoSimples = true;
      r = await enviar(true);
      texto = await r.text();
    }
  } catch {
    throw new ErroGemini('O Gemini não respondeu a tempo.', 'falha');
  }

  if (!r.ok) {
    console.error('[gemini]', r.status, texto.slice(0, 600));
    throw erroDoGoogle(r.status, texto, modelo);
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
    // no formato simples o modelo às vezes embrulha o JSON em ```json ... ```
    const ini = saida.indexOf('{');
    const fim = saida.lastIndexOf('}');
    dados = JSON.parse(ini >= 0 && fim > ini ? saida.slice(ini, fim + 1) : saida) as T;
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
