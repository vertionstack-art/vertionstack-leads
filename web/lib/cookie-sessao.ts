/**
 * O cookie da sessão do Supabase só é lido pelo servidor: nenhuma tela usa o
 * Supabase no navegador. HttpOnly impede que um script na página leia o
 * token de login, mesmo que algum texto malicioso escape para o HTML.
 */
export const COOKIE_DA_SESSAO = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 400 * 24 * 60 * 60,
};
