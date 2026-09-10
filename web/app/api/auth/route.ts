import { NextResponse } from 'next/server';
import { COOKIE, senhaConfere, tokenDeSessao, exigeSenha } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };

  if (!exigeSenha) {
    return NextResponse.json({ ok: true, aviso: 'Painel sem senha configurada.' });
  }

  if (!senha || !(await senhaConfere(senha))) {
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(COOKIE, await tokenDeSessao(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return resp;
}

export async function DELETE() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.delete(COOKIE);
  return resp;
}
