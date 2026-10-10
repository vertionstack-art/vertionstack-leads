/**
 * As travas extras da central de administração, além do endereço secreto, da
 * senha e do Google Authenticator:
 *
 *  - aparelho liberado: a central só abre em navegador que já foi liberado
 *    uma vez pelo link de liberação (ADMIN_CHAVE). Em qualquer outro aparelho
 *    responde "não encontrado" — mesmo com e-mail, senha, código e endereço;
 *  - código recente: o segundo fator vale por algumas horas; passado isso,
 *    a central pede o código de novo.
 *
 * Só usa a Web Crypto, que existe tanto no proxy quanto nas rotas.
 */

export const COOKIE_APARELHO = 'vl_ca';
/** por quanto tempo o navegador fica liberado */
export const DIAS_APARELHO = 180;
/** por quanto tempo o código do Google Authenticator vale para a central */
export const HORAS_CODIGO = 8;

const codificar = new TextEncoder();

/** o ADMIN_EMAILS da Vercel, sem depender do banco (o proxy roda antes de tudo) */
export function emailEhAdmin(email: string | null | undefined): boolean {
  const lista = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && lista.includes(String(email).toLowerCase());
}

function chave(): string | null {
  const k = process.env.ADMIN_CHAVE || '';
  return k.length >= 32 ? k : null;
}

/** compara sem vazar pelo tempo de resposta quantos caracteres batem */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function assinar(texto: string): Promise<string | null> {
  const k = chave();
  if (!k) return null;
  const cripto = await crypto.subtle.importKey('raw', codificar.encode(k), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign('HMAC', cripto, codificar.encode(texto));
  return Array.from(new Uint8Array(assinatura), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** o valor do cookie que libera este administrador neste navegador */
export async function tokenDoAparelho(userId: string): Promise<string | null> {
  return assinar(`central-aparelho:${userId}`);
}

export async function aparelhoLiberado(userId: string, cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  const esperado = await tokenDoAparelho(userId);
  return Boolean(esperado) && iguais(cookie, esperado!);
}

/** o ?liberar= do link de liberação confere com a ADMIN_CHAVE? */
export function liberacaoValida(enviado: string | null): boolean {
  const k = chave();
  return Boolean(k && enviado) && iguais(enviado!, k!);
}

/**
 * O código do Google Authenticator foi digitado nas últimas horas? O Supabase
 * informa quando cada método de entrada foi usado nesta sessão.
 */
export function codigoRecente(metodos: { method: string; timestamp: number }[] | undefined): boolean {
  const totp = (metodos || []).filter((m) => m.method === 'totp').map((m) => m.timestamp);
  if (!totp.length) return false;
  return Date.now() / 1000 - Math.max(...totp) < HORAS_CODIGO * 3600;
}
