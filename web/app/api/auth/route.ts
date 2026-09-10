import { NextResponse } from 'next/server';
import { COOKIE, entrar, exigeSenha, usuarioAtual } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, usuario: await usuarioAtual() });
}

export async function POST(req: Request) {
  const { nome, senha } = (await req.json().catch(() => ({}))) as { nome?: string; senha?: string };

  if (!exigeSenha) {
    return NextResponse.json({ ok: true, usuario: 'equipe', aviso: 'Painel sem senha configurada.' });
  }

  const sessao = senha ? await entrar(nome || '', senha) : null;

  if (!sessao) {
    return NextResponse.json({ ok: false, erro: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const resp = NextResponse.json({ ok: true, usuario: sessao.slice(0, sessao.lastIndexOf('.')) });
  resp.cookies.set(COOKIE, sessao, {
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
