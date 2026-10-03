import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { barrarSePreciso, resposta } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** troca a senha de quem chegou pelo link do e-mail (ou está logado) */
export async function POST(req: Request) {
  const barrado = await barrarSePreciso(req, 'nova-senha', null, { porIp: 10, porEmail: 0, janelaSegundos: 15 * 60 });
  if (barrado) return barrado;

  const corpo = (await req.json().catch(() => ({}))) as { senha?: string };
  const senha = String(corpo.senha || '');
  if (senha.length < 8) return resposta('A senha precisa ter pelo menos 8 caracteres.', 400);
  if (senha.length > 72) return resposta('A senha pode ter no máximo 72 caracteres.', 400);

  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return resposta('O link expirou. Peça um novo em "Esqueci minha senha".', 401);

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    if (/weak|pwned|leaked/i.test(error.message)) return resposta('Essa senha é fraca ou já vazou na internet. Escolha outra.', 400);
    if (/different/i.test(error.message)) return resposta('A nova senha precisa ser diferente da antiga.', 400);
    return resposta('Não consegui trocar a senha agora.', 500);
  }
  return NextResponse.json({ ok: true });
}
