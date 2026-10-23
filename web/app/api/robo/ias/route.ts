import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { ErroIa } from '@/lib/cabeca';
import { geminiLigado, perguntarJson as perguntarGemini } from '@/lib/gemini';
import { groqLigado, modelosGroq, perguntarModelo } from '@/lib/groq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ESQUEMA = { type: 'object', required: ['resposta'], properties: { resposta: { type: 'string' } } };
const INSTRUCOES = 'Você é um teste de conexão. Responda em português, em uma palavra.';
const PEDIDO = 'Diga "ok".';

interface Teste {
  ia: string;
  ok: boolean;
  detalhe: string;
  ms: number;
}

async function medir(ia: string, f: () => Promise<unknown>): Promise<Teste> {
  const inicio = Date.now();
  try {
    await f();
    return { ia, ok: true, detalhe: 'Respondeu.', ms: Date.now() - inicio };
  } catch (e) {
    return { ia, ok: false, detalhe: e instanceof ErroIa ? e.message : 'Falhou sem explicar.', ms: Date.now() - inicio };
  }
}

/**
 * "Testar as IAs": um pedido mínimo para cada IA configurada na Vercel
 * (cada modelo do Groq e o Gemini), para saber quem responde de verdade sem
 * mostrar chave nenhuma. A IA do PC fica de fora de propósito.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false }, { status: 404 });
  if (await estourou('ias:' + s.sessao.userId, 4, 60)) {
    return NextResponse.json({ ok: false, erro: 'Espere um minuto para testar de novo.' }, { status: 429 });
  }
  const testes: Promise<Teste>[] = [];
  if (groqLigado()) for (const m of modelosGroq()) testes.push(medir(`Groq · ${m}`, () => perguntarModelo(m, INSTRUCOES, PEDIDO, ESQUEMA)));
  if (geminiLigado()) testes.push(medir('Gemini (reserva)', () => perguntarGemini(INSTRUCOES, PEDIDO, ESQUEMA)));
  const resultados = await Promise.all(testes);
  return NextResponse.json({
    ok: true,
    resultados,
    faltando: [!groqLigado() && 'GROQ_API_KEY', !geminiLigado() && 'GEMINI_API_KEY'].filter(Boolean),
  });
}
