/**
 * Para onde apontam os links dos e-mails (confirmar cadastro, trocar senha)
 * e a volta do login com Google. Troca o código do link por uma sessão e
 * leva a pessoa adiante.
 */

import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServidor } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** só caminho interno: "proximo=https://golpe.com" não pode virar redirecionamento para fora */
function destinoSeguro(v: string | null): string {
  return v && /^\/(?!\/)[\w\-/]*$/.test(v) ? v : '/';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const proximo = destinoSeguro(url.searchParams.get('proximo'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const tipo = url.searchParams.get('type') as EmailOtpType | null;

  const supabase = await supabaseServidor();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && tipo) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;
  }

  if (!ok) return NextResponse.redirect(new URL('/login?erro=link', url.origin));
  const alvo = tipo === 'recovery' ? '/nova-senha' : proximo;
  return NextResponse.redirect(new URL(alvo, url.origin));
}
