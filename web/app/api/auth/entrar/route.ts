import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { registrarAcesso } from '@/lib/acessos';
import { barrarSePreciso, emailValido, resposta } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { email?: string; senha?: string };
  const email = emailValido(corpo.email);
  const senha = String(corpo.senha || '');

  // 20 tentativas por IP e 8 por e-mail a cada 15 minutos
  const barrado = await barrarSePreciso(req, 'entrar', email, { porIp: 20, porEmail: 8, janelaSegundos: 15 * 60 });
  if (barrado) {
    await registrarAcesso(req, 'login', 'bloqueado', email);
    return barrado;
  }
  if (!email || !senha) return resposta('Preencha o e-mail e a senha.', 400);

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    await registrarAcesso(req, 'login', 'senha_errada', email);
    // mesma mensagem para e-mail inexistente e senha errada: não diz quem tem conta
    const naoConfirmado = /not confirmed/i.test(error.message);
    return resposta(
      naoConfirmado
        ? 'Confirme seu e-mail primeiro: abra o link que mandamos quando você criou a conta.'
        : 'E-mail ou senha incorretos.',
      401,
    );
  }

  await registrarAcesso(req, 'login', 'ok', email);
  return NextResponse.json({ ok: true });
}
