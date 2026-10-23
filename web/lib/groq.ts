/**
 * IA na nuvem pelo Groq (grátis, sem cartão), para o robô e o copiloto não
 * dependerem da placa de vídeo do PC (que travou duas vezes com a IA
 * rodando em 23/10/2026).
 *
 * O plano grátis limita tokens por minuto e por dia POR MODELO, então são
 * dois modelos: se o primeiro estiver no limite, tenta o segundo. Os dois
 * respondem no formato fixo (json_schema estrito), como a IA do PC fazia.
 *
 * Variáveis na Vercel:
 *   GROQ_API_KEY    a chave (console.groq.com → API Keys)
 *   GROQ_MODELOS    opcional; padrão "openai/gpt-oss-120b,qwen/qwen3.8-27b"
 *
 * Só roda no servidor.
 */

import { ErroGemini, type RespostaGemini } from './gemini';

const PADRAO = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];

export function groqLigado(): boolean {
  return Boolean((process.env.GROQ_API_KEY || '').trim());
}

export function modelosGroq(): string[] {
  const lista = (process.env.GROQ_MODELOS || '').split(',').map((m) => m.trim()).filter(Boolean);
  return lista.length ? lista : PADRAO;
}

/**
 * O modo estrito do Groq exige additionalProperties: false em todo objeto e
 * não aceita alguns limites (maxItems); o resto do esquema fica igual.
 */
function esquemaEstrito(e: unknown): unknown {
  if (Array.isArray(e)) return e.map(esquemaEstrito);
  if (!e || typeof e !== 'object') return e;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e as Record<string, unknown>)) {
    if (k === 'maxItems' || k === 'minItems') continue;
    saida[k] = esquemaEstrito(v);
  }
  if (saida.type === 'object') saida.additionalProperties = false;
  return saida;
}

/** cada família de modelo desliga o "pensar em voz alta" de um jeito; o esquema já obriga a pensar antes */
function opcoesDoModelo(modelo: string): Record<string, unknown> {
  if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
  if (modelo.startsWith('qwen/')) return { reasoning_effort: 'none', reasoning_format: 'hidden' };
  return {};
}

export async function perguntarModelo<T>(modelo: string, instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  let r: Response;
  try {
    r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${(process.env.GROQ_API_KEY || '').trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: instrucoes },
          { role: 'user', content: pedido },
        ],
        temperature: 0.7,
        max_completion_tokens: 1500,
        response_format: { type: 'json_schema', json_schema: { name: 'resposta', strict: true, schema: esquemaEstrito(esquema) } },
        ...opcoesDoModelo(modelo),
      }),
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
  } catch {
    throw new ErroGemini('O Groq não respondeu a tempo.', 'falha');
  }
  const texto = await r.text();
  if (!r.ok) {
    console.error('[groq]', modelo, r.status, texto.slice(0, 300));
    if (r.status === 401 || r.status === 403) throw new ErroGemini('A chave do Groq foi recusada. Confira a GROQ_API_KEY na Vercel.', 'chave');
    if (r.status === 429) {
      // "Please try again in 19.5s": quanto falta para o minuto liberar
      const bruto = texto.match(/try again in ([\d.]+)s/)?.[1] ?? r.headers.get('retry-after');
      const s = bruto ? Number(bruto) : NaN;
      throw Object.assign(new ErroGemini('O Groq chegou ao limite grátis por agora.', 'limite'), Number.isFinite(s) ? { esperarS: s } : {});
    }
    // pedido maior que o limite do modelo (413): o próximo modelo pode aceitar
    throw new ErroGemini(`O Groq recusou o pedido (${r.status}).`, 'falha');
  }
  const j = JSON.parse(texto) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
  const conteudo = j.choices?.[0]?.message?.content || '';
  let dados: T;
  try {
    const ini = conteudo.indexOf('{');
    const fim = conteudo.lastIndexOf('}');
    dados = JSON.parse(ini >= 0 && fim > ini ? conteudo.slice(ini, fim + 1) : conteudo) as T;
  } catch {
    throw new ErroGemini(j.choices?.[0]?.finish_reason === 'length' ? 'A resposta do Groq veio cortada.' : 'O Groq respondeu num formato errado.', 'falha');
  }
  return { dados, entrada: j.usage?.prompt_tokens || 0, saida: j.usage?.completion_tokens || 0, modelo: `groq:${j.model || modelo}` };
}

/** o limite grátis é por minuto: esperar até isso compensa mais que desistir */
const ESPERA_MAXIMA_S = 25;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tenta os modelos na ordem. Se todos estão no limite do minuto, espera o
 * tempo que o Groq disser (até 25 s) e tenta de novo no que libera antes.
 * Chave recusada para na hora (os outros falhariam igual).
 */
export async function perguntarJsonGroq<T>(instrucoes: string, pedido: string, esquema: Record<string, unknown>): Promise<RespostaGemini<T>> {
  let ultimo: ErroGemini | null = null;
  let menorEspera: { modelo: string; segundos: number } | null = null;
  for (const modelo of modelosGroq()) {
    try {
      return await perguntarModelo<T>(modelo, instrucoes, pedido, esquema);
    } catch (e) {
      if (!(e instanceof ErroGemini) || e.tipo === 'chave') throw e;
      ultimo = e;
      const s = (e as ErroGemini & { esperarS?: number }).esperarS;
      if (s !== undefined && (!menorEspera || s < menorEspera.segundos)) menorEspera = { modelo, segundos: s };
    }
  }
  if (menorEspera && menorEspera.segundos <= ESPERA_MAXIMA_S) {
    await dormir((menorEspera.segundos + 1) * 1000);
    return perguntarModelo<T>(menorEspera.modelo, instrucoes, pedido, esquema);
  }
  throw ultimo || new ErroGemini('O Groq não respondeu.', 'falha');
}
