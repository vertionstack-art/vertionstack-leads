import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { registrarAcesso } from '@/lib/acessos';
import { barrarSePreciso, emailValido, origemDoSite, resposta } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { nome?: string; email?: string; senha?: string };
  const email = emailValido(corpo.email);
  const nome = String(corpo.nome || '').trim().slice(0, 60);
  const senha = String(corpo.senha || '');

  // cadastro é a porta preferida de robô: 5 por IP por hora
  const barrado = await barrarSePreciso(req, 'cadastro', email, { porIp: 5, porEmail: 3, janelaSegundos: 60 * 60 });
  if (barrado) return barrado;

  if (!nome) return resposta('Diga como podemos te chamar.', 400);
  if (!email) return resposta('Esse e-mail não parece certo.', 400);
  if (senha.length < 8) return resposta('A senha precisa ter pelo menos 8 caracteres.', 400);
  if (senha.length > 72) return resposta('A senha pode ter no máximo 72 caracteres.', 400);

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome },
      emailRedirectTo: `${origemDoSite(req)}/auth/confirmar`,
    },
  });

  if (error) {
    if (/weak|pwned|leaked/i.test(error.message)) {
      return resposta('Essa senha é fraca ou já vazou na internet. Escolha outra.', 400);
    }
    if (/rate limit/i.test(error.message)) {
      return resposta('Muitos cadastros agora. Tente de novo em alguns minutos.', 429);
    }
    console.error('[cadastro]', error.message);
    return resposta('Não consegui criar a conta agora. Tente de novo.', 500);
  }

  await registrarAcesso(req, 'cadastro', 'ok', email);

  // com confirmação de e-mail ligada, ainda não há sessão: a pessoa precisa clicar no link
  return NextResponse.json({ ok: true, confirmar: !data.session });
}
