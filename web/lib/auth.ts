/**
 * Porteiro das rotas: quem está logado, e se a requisição veio mesmo do
 * nosso site.
 *
 * O login de verdade é do Supabase Auth (lib/conta.ts resolve a sessão em
 * conta e plano). Aqui ficam só os atalhos que as rotas usam.
 */

import { NextResponse } from 'next/server';
import { sessaoAtual, type Sessao } from './conta';

export type { Sessao };

/** a sessão, ou uma resposta 401 pronta para devolver */
export async function exigirSessao(): Promise<{ sessao: Sessao; erro?: never } | { sessao?: never; erro: NextResponse }> {
  const sessao = await sessaoAtual();
  if (!sessao) return { erro: NextResponse.json({ ok: false, erro: 'Entre na sua conta de novo.' }, { status: 401 }) };
  if (sessao.bloqueada) {
    return { erro: NextResponse.json({ ok: false, erro: 'Esta conta está suspensa. Fale com o suporte.' }, { status: 403 }) };
  }
  return { sessao };
}

/**
 * Pedido que muda alguma coisa precisa ter saído do nosso próprio site.
 *
 * Sem isto, uma página qualquer na internet poderia fazer o navegador de
 * quem está logado mandar um "apagar todos os leads" — o cookie iria junto.
 * O navegador sempre manda Origin em POST/PATCH/DELETE, e ele não é
 * falsificável por uma página de terceiros.
 */
export function origemConfere(req: Request): boolean {
  const origem = req.headers.get('origin');
  if (!origem) return true; // ferramentas fora do navegador (a extensão usa chave, não cookie)
  try {
    const o = new URL(origem);
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    return o.host === host;
  } catch {
    return false;
  }
}

export function recusarOrigem(): NextResponse {
  return NextResponse.json({ ok: false, erro: 'Pedido recusado.' }, { status: 403 });
}

/**
 * O administrador passou pelo código de 6 dígitos nesta sessão?
 *
 * "aal2" é o nível que o Supabase dá à sessão depois do segundo fator. Sem
 * ele, mesmo com a senha certa, a central não abre: roubar a senha não basta,
 * precisa também do celular com o Google Authenticator.
 */
export async function nivelDaSessao(): Promise<'aal1' | 'aal2' | null> {
  const { supabaseServidor } = await import('./supabase-server');
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return (data?.currentLevel as 'aal1' | 'aal2' | null) ?? null;
}

/** o administrador está num navegador liberado (lib/guarda-central)? */
export async function aparelhoDoAdmin(userId: string): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const { aparelhoLiberado, COOKIE_APARELHO } = await import('./guarda-central');
  return aparelhoLiberado(userId, (await cookies()).get(COOKIE_APARELHO)?.value);
}

/** o código do Google Authenticator foi digitado nesta sessão nas últimas horas? */
export async function codigoDoAdminRecente(): Promise<boolean> {
  const { supabaseServidor } = await import('./supabase-server');
  const { codigoRecente } = await import('./guarda-central');
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2' && codigoRecente(data.currentAuthenticationMethods as { method: string; timestamp: number }[]);
}

const NAO_ENCONTRADO = () => NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });

/**
 * Sessão de administrador, num aparelho liberado, com o código do Google
 * Authenticator digitado há pouco — ou a resposta pronta de recusa. Para
 * quem não é o administrador (ou está noutro aparelho) a rota não existe.
 */
export async function exigirAdmin(): Promise<{ sessao: Sessao; erro?: never } | { sessao?: never; erro: NextResponse }> {
  const sessao = await sessaoAtual();
  if (!sessao?.admin) return { erro: NAO_ENCONTRADO() };
  if (!(await aparelhoDoAdmin(sessao.userId))) return { erro: NAO_ENCONTRADO() };
  if (!(await codigoDoAdminRecente())) {
    return { erro: NextResponse.json({ ok: false, erro: 'Confirme o código do Google Authenticator de novo.' }, { status: 401 }) };
  }
  const { estourou } = await import('./limite');
  if (await estourou('central-api:' + sessao.userId, 600, 60 * 60)) {
    return { erro: NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere alguns minutos.' }, { status: 429 }) };
  }
  return { sessao };
}
