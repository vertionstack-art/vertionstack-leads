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
import { aparelhoLiberado, COOKIE_APARELHO, DIAS_APARELHO, emailEhAdmin, liberacaoValida, tokenDoAparelho } from '@/lib/guarda-central';

const PUBLICAS = ['/login', '/cadastro', '/esqueci', '/auth/', '/p/', '/termos', '/privacidade'];

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
  // o endereço principal sem login é a página de venda (app/page.tsx decide qual das duas mostra)
  const publica = caminho === '/' || PUBLICAS.some((p) => caminho === p || caminho.startsWith(p));

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
  let central = false;
  if (caminho === '/central' || caminho.startsWith('/central/') || caminho === '/admin' || caminho.startsWith('/admin/')) {
    interno = '/nao-encontrado';
  } else if (segredo && (caminho === '/' + segredo || caminho.startsWith('/' + segredo + '/'))) {
    /*
     * Quem não é o administrador, ou é mas está num navegador que nunca foi
     * liberado, recebe o mesmo "não encontrado" de um endereço inventado —
     * decidido aqui, antes de qualquer página rodar, para nem o tempo de
     * resposta denunciar que existe algo neste endereço.
     */
    const usuario = data.user!;
    if (!emailEhAdmin(usuario.email)) {
      interno = '/nao-encontrado';
    } else if (req.nextUrl.searchParams.has('liberar')) {
      if (!liberacaoValida(req.nextUrl.searchParams.get('liberar'))) {
        interno = '/nao-encontrado';
      } else {
        // link de liberação certo: grava a chave deste navegador e tira o segredo da barra de endereço
        const limpo = req.nextUrl.clone();
        limpo.search = '';
        const ir = NextResponse.redirect(limpo);
        for (const c of resposta.cookies.getAll()) ir.cookies.set(c);
        ir.cookies.set(COOKIE_APARELHO, (await tokenDoAparelho(usuario.id))!, {
          httpOnly: true,
          secure: req.nextUrl.protocol === 'https:',
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24 * DIAS_APARELHO,
        });
        ir.headers.set('Referrer-Policy', 'no-referrer');
        ir.headers.set('Cache-Control', 'no-store');
        return comRastro(req, novoRastro, ir);
      }
    } else if (!(await aparelhoLiberado(usuario.id, req.cookies.get(COOKIE_APARELHO)?.value))) {
      interno = '/nao-encontrado';
    } else {
      interno = '/central' + caminho.slice(segredo.length + 1);
      central = true;
    }
  }
  if (interno) {
    const alvo = req.nextUrl.clone();
    alvo.pathname = interno;
    alvo.search = '';
    const desvio = NextResponse.rewrite(alvo, { request: req });
    for (const c of resposta.cookies.getAll()) desvio.cookies.set(c);
    if (central) {
      // nunca fica guardada no navegador nem vai como origem para outro site
      desvio.headers.set('Cache-Control', 'no-store, max-age=0');
      desvio.headers.set('Referrer-Policy', 'no-referrer');
    }
    return comRastro(req, novoRastro, desvio);
  }
  return comRastro(req, novoRastro, resposta);
}

export const config = {
  // páginas, não as rotas de API (que respondem 401 sozinhas) nem arquivos estáticos
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|zip|css|js)$).*)'],
};
