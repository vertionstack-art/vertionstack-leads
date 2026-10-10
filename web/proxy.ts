/**
 * Roda antes de toda página: renova a sessão do Supabase (o token de acesso
 * dura pouco e precisa ser trocado no cookie) e manda quem não está logado
 * para a tela de entrar.
 *
 * Não é a única trava — cada rota e cada página confere a sessão de novo
 * no servidor. Isto aqui é para a sessão não expirar no meio do uso e para
 * ninguém ver o painel vazio antes do redirecionamento.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { caminhoCentral } from '@/lib/caminho-central';

const PUBLICAS = ['/login', '/cadastro', '/esqueci', '/auth/', '/p/'];

/**
 * O rastro do navegador para a trava do teste grátis (lib/teste): um id
 * aleatório, sem nada da pessoa, que dura dois anos. Entra também na própria
 * requisição, para a página já enxergar no primeiro acesso.
 */
function comRastro(req: NextRequest, novo: string | null, r: NextResponse): NextResponse {
  if (novo) {
    r.cookies.set('vl_disp', novo, {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 730,
    });
  }
  return r;
}

export async function proxy(req: NextRequest) {
  const novoRastro = req.cookies.get('vl_disp') ? null : crypto.randomUUID();
  if (novoRastro) req.cookies.set('vl_disp', novoRastro);
  let resposta = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return comRastro(req, novoRastro, resposta);

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        resposta = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
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
    return comRastro(req, novoRastro, NextResponse.redirect(destino));
  }

  /*
   * A central de administração não tem endereço fixo (lib/caminho-central).
   * A pasta /central não abre direto: responde "não encontrado", como
   * qualquer endereço inventado. Só o caminho secreto da Vercel leva até ela.
   */
  const segredo = caminhoCentral();
  let interno: string | null = null;
  if (caminho === '/central' || caminho.startsWith('/central/') || caminho === '/admin' || caminho.startsWith('/admin/')) {
    interno = '/nao-encontrado';
  } else if (segredo && (caminho === '/' + segredo || caminho.startsWith('/' + segredo + '/'))) {
    interno = '/central' + caminho.slice(segredo.length + 1);
  }
  if (interno) {
    const alvo = req.nextUrl.clone();
    alvo.pathname = interno;
    const desvio = NextResponse.rewrite(alvo, { request: req });
    for (const c of resposta.cookies.getAll()) desvio.cookies.set(c);
    desvio.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return comRastro(req, novoRastro, desvio);
  }
  return comRastro(req, novoRastro, resposta);
}

export const config = {
  // páginas, não as rotas de API (que respondem 401 sozinhas) nem arquivos estáticos
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|zip|css|js)$).*)'],
};
