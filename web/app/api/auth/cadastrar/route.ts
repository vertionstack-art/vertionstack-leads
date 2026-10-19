import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { registrarAcesso } from '@/lib/acessos';
import { barrarSePreciso, emailValido, origemDoSite, resposta } from '@/lib/porta';
import { VERSAO_TERMOS } from '@/lib/legal';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/sql';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { nome?: string; email?: string; senha?: string; aceite?: string; plano?: string; convite?: string };
  const email = emailValido(corpo.email);
  const nome = String(corpo.nome || '').trim().slice(0, 60);
  const senha = String(corpo.senha || '');
  const planoEscolhido = ['semanal', 'basic', 'pro'].includes(String(corpo.plano)) ? String(corpo.plano) : null;
  // o convite chega pela URL do cadastro ou pelo cookie que o link de convite deixou (proxy.ts)
  const conviteBruto = String(corpo.convite || '').toLowerCase() || (req.headers.get('cookie')?.match(/(?:^|;\s*)vl_convite=([a-z0-9]{6,12})/)?.[1] ?? '');
  const convite = /^[a-z0-9]{6,12}$/.test(conviteBruto) ? conviteBruto : null;

  // cadastro é a porta preferida de robô: 5 por IP por hora
  const barrado = await barrarSePreciso(req, 'cadastro', email, { porIp: 5, porEmail: 3, janelaSegundos: 60 * 60 });
  if (barrado) return barrado;

  if (!nome) return resposta('Diga como podemos te chamar.', 400);
  if (corpo.aceite !== 'sim') return resposta('Para criar a conta, aceite os Termos de uso e a Política de privacidade.', 400);
  if (!email) return resposta('Esse e-mail não parece certo.', 400);
  if (senha.length < 8) return resposta('A senha precisa ter pelo menos 8 caracteres.', 400);
  if (senha.length > 72) return resposta('A senha pode ter no máximo 72 caracteres.', 400);

  /*
   * Passe de uso único: o Supabase só cria conta por e-mail quando ele existe
   * (gancho "Before User Created", migração 0021). Sem isso, a chave pública
   * criaria conta direto no Supabase, pulando tudo o que esta rota confere.
   */
  const porta = randomBytes(24).toString('base64url');
  await db()`insert into cadastros_liberados (passe, email) values (${porta}, ${email})`;

  const supabase = await supabaseServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      // qual versão dos Termos e da Política a pessoa aceitou, e quando (prova do aceite)
      data: {
        porta,
        nome,
        termos_versao: VERSAO_TERMOS,
        termos_aceitos_em: new Date().toISOString(),
        ...(planoEscolhido ? { plano_escolhido: planoEscolhido } : {}),
        ...(convite ? { convite } : {}),
      },
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
