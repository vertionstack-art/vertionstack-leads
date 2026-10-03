import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { barrarSePreciso, emailValido, origemDoSite, resposta } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { email?: string };
  const email = emailValido(corpo.email);

  const barrado = await barrarSePreciso(req, 'esqueci', email, { porIp: 5, porEmail: 3, janelaSegundos: 60 * 60 });
  if (barrado) return barrado;
  if (!email) return resposta('Esse e-mail não parece certo.', 400);

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origemDoSite(req)}/auth/confirmar?proximo=/nova-senha`,
  });
  if (error) console.error('[esqueci]', error.message);

  // sempre a mesma resposta: dizer "esse e-mail não existe" entregaria quem tem conta
  return NextResponse.json({ ok: true });
}
