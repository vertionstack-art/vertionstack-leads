/**
 * Duas portas de entrada, cada uma com sua chave:
 *
 *  - a extensão manda leads usando o header x-api-key  (INGEST_TOKEN)
 *  - você entra no painel com uma senha, que vira cookie (DASHBOARD_PASSWORD)
 *
 * Se as variáveis não estiverem definidas, o painel roda aberto — o que
 * é aceitável no seu localhost e péssimo na internet. A tela avisa.
 */

import { cookies } from 'next/headers';

export const COOKIE = 'vl_sessao';

const INGEST_TOKEN = process.env.INGEST_TOKEN || '';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

export const exigeChave = Boolean(INGEST_TOKEN);
export const exigeSenha = Boolean(DASHBOARD_PASSWORD);

/** comparação em tempo constante, para não vazar a chave pelo tempo de resposta */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function hashDaSenha(senha: string): Promise<string> {
  const dados = new TextEncoder().encode('vertion-leads:' + senha);
  const buf = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function chaveValida(req: Request): boolean {
  if (!exigeChave) return true;
  const enviada = req.headers.get('x-api-key') || '';
  return iguais(enviada, INGEST_TOKEN);
}

export async function senhaConfere(senha: string): Promise<boolean> {
  if (!exigeSenha) return true;
  return iguais(senha, DASHBOARD_PASSWORD);
}

export async function tokenDeSessao(): Promise<string> {
  return hashDaSenha(DASHBOARD_PASSWORD);
}

export async function estaLogado(): Promise<boolean> {
  if (!exigeSenha) return true;
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value || '';
  return iguais(valor, await tokenDeSessao());
}

/** aceita quem tem sessão no navegador OU a chave da extensão */
export async function podeLer(req: Request): Promise<boolean> {
  if (await estaLogado()) return true;
  return exigeChave && chaveValida(req);
}
