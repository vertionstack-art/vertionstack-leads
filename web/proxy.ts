/**
 * Roda antes de toda página: renova a sessão do login (o token de acesso
 * dura pouco e precisa ser trocado no cookie) e manda quem não está logado
 * para a tela de entrar.
 *
 * Não é a única trava — cada rota e cada página confere a sessão de novo
 * no servidor. Isto aqui é para a sessão não expirar no meio do uso e para
 * ninguém ver o painel vazio antes do redirecionamento.
 *
 * Desde 21/11/2026 a ferramenta é só do Lucas: sem página de venda, cadastro,
 * central de administração nem convite. Públicos ficam só o login, a troca
 * de senha e os links que vão para clientes (proposta e prévia do site).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { COOKIE_DA_SESSAO } from '@/lib/cookie-sessao';

const PUBLICAS = ['/login', '/esqueci', '/auth/', '/p/', '/s/', '/manifest.webmanifest'];

export async function proxy(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return resposta;

  const supabase = createServerClient(url, chave, {
    cookieOptions: COOKIE_DA_SESSAO,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        resposta = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) {
          resposta.cookies.set(name, value, { ...options, ...COOKIE_DA_SESSAO, maxAge: options?.maxAge ?? COOKIE_DA_SESSAO.maxAge });
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const caminho = req.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho === p || caminho.startsWith(p));

  if (!data.user && !publica) {
    const destino = req.nextUrl.clone();
    destino.pathname = '/login';
    destino.search = '';
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  // páginas, não as rotas de API (que respondem 401 sozinhas) nem arquivos estáticos
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|zip|css|js)$).*)'],
};
