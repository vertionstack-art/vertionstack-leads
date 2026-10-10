/**
 * Apagar uma pessoa de vez, pela central. A ação mais perigosa da ferramenta,
 * então pede tudo de novo na hora, além da sessão de administrador num
 * aparelho liberado:
 *  - a senha do administrador (conferida no Supabase Auth, sem trocar a sessão);
 *  - um código novo do Google Authenticator;
 *  - o e-mail de quem vai ser apagado, digitado por extenso.
 * Poucas tentativas por hora, e cada tentativa fica registrada em Acessos.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exigirAdmin, origemConfere, recusarOrigem } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import { estourou } from '@/lib/limite';
import { emailEhAdmin } from '@/lib/guarda-central';
import { apagarPessoa } from '@/lib/central';
import { db } from '@/lib/sql';
import { CHAVE_PUBLICA, URL_SUPABASE, supabaseServidor } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const erro = (msg: string, status: number) => NextResponse.json({ ok: false, erro: msg }, { status });

/** confere a senha num cliente à parte, sem mexer na sessão do navegador, e descarta a sessão criada */
async function senhaConfere(email: string, senha: string): Promise<boolean> {
  const avulso = createClient(URL_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await avulso.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return false;
  await avulso.auth.signOut({ scope: 'local' }).catch(() => {});
  return true;
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  const admin = a.sessao;
  const ip = ipDaRequisicao(req);

  if ((await estourou('apagar:' + admin.userId, 5, 60 * 60)) || (await estourou('apagar-ip:' + ip, 5, 60 * 60))) {
    return erro('Tentativas demais. Espere uma hora.', 429);
  }

  const c = (await req.json().catch(() => ({}))) as { userId?: string; email?: string; senha?: string; codigo?: string };
  const alvo = typeof c.userId === 'string' && UUID.test(c.userId) ? c.userId : null;
  const codigo = String(c.codigo || '').replace(/\D/g, '');
  const senha = String(c.senha || '');
  if (!alvo || !senha || codigo.length !== 6) return erro('Preencha tudo: o e-mail, a sua senha e o código de 6 números.', 400);

  const [pessoa] = await db()`select id, email from public.usuarios_para_central() where id = ${alvo}`;
  if (!pessoa) return erro('Essa pessoa não existe mais.', 404);
  if (alvo === admin.userId || emailEhAdmin(pessoa.email)) return erro('A conta do administrador não pode ser apagada por aqui.', 400);
  if (String(c.email || '').trim().toLowerCase() !== String(pessoa.email).toLowerCase()) {
    return erro('O e-mail digitado não é o dessa pessoa.', 400);
  }

  // 1) a senha de novo
  if (!(await senhaConfere(admin.email, senha))) {
    await registrarAcesso(req, `central-apagar ${pessoa.email}`, 'senha_errada', admin.email);
    return erro('Senha errada.', 401);
  }

  // 2) um código novo do Google Authenticator
  const supabase = await supabaseServidor();
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const fator = (fatores?.totp || []).find((f) => f.status === 'verified');
  const verificado = fator ? await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo }) : null;
  if (!verificado || verificado.error) {
    await registrarAcesso(req, `central-apagar ${pessoa.email}`, 'chave_errada', admin.email);
    return erro('Código errado ou vencido. Use o número que está aparecendo agora no app.', 401);
  }

  // 3) apaga
  try {
    const r = await apagarPessoa(alvo);
    await registrarAcesso(req, `central-apagar ${pessoa.email}`, 'ok', admin.email);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[central apagar]', e);
    return erro('Não consegui cancelar a assinatura dessa pessoa na Stripe, então nada foi apagado. Tente de novo em alguns minutos.', 502);
  }
}
