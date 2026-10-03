/**
 * Segundo fator (Google Authenticator) para o administrador.
 *
 * GET  → se a pessoa já tem o app ligado e se a sessão já passou pelo código
 * POST { acao: 'cadastrar' }                  → gera o QR Code para ler no app
 * POST { acao: 'confirmar', fator, codigo }   → confirma o primeiro código e liga o fator
 * POST { acao: 'verificar', codigo }          → código do dia a dia, sobe a sessão para aal2
 *
 * O segredo do QR Code nunca passa pelo nosso banco: quem guarda é o
 * Supabase Auth. Tentativas de código têm limite, senão 6 dígitos cairiam
 * no chute em pouco tempo.
 */

import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase-server';
import { sessaoAtual } from '@/lib/conta';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function erro(mensagem: string, status: number) {
  return NextResponse.json({ ok: false, erro: mensagem }, { status });
}

export async function GET() {
  const sessao = await sessaoAtual();
  if (!sessao?.admin) return erro('Só o administrador usa isto.', 403);

  const supabase = await supabaseServidor();
  const [{ data: fatores }, { data: nivel }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const ligado = (fatores?.totp || []).some((f) => f.status === 'verified');
  return NextResponse.json({ ok: true, ligado, confirmado: nivel?.currentLevel === 'aal2' });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const sessao = await sessaoAtual();
  if (!sessao?.admin) return erro('Só o administrador usa isto.', 403);

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; fator?: string; codigo?: string };
  const codigo = String(corpo.codigo || '').replace(/\D/g, '');
  const supabase = await supabaseServidor();

  if (corpo.acao === 'cadastrar') {
    const { data: lista } = await supabase.auth.mfa.listFactors();
    if ((lista?.totp || []).some((f) => f.status === 'verified')) {
      return erro('O Google Authenticator já está ligado nesta conta.', 400);
    }
    // um cadastro que ficou pela metade (QR lido mas código nunca confirmado) atrapalha o novo
    for (const f of lista?.all || []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Google Authenticator', issuer: 'Vertion Leads' });
    if (error || !data) return erro('Não consegui gerar o QR Code agora.', 500);
    const qr = data.totp.qr_code.startsWith('data:') ? data.totp.qr_code : 'data:image/svg+xml;utf-8,' + data.totp.qr_code;
    return NextResponse.json({ ok: true, fator: data.id, qr, segredo: data.totp.secret });
  }

  if (corpo.acao === 'confirmar' || corpo.acao === 'verificar') {
    if (await estourou('2fa:' + sessao.userId, 6, 15 * 60)) return erro('Códigos errados demais. Espere 15 minutos.', 429);
    if (codigo.length !== 6) return erro('O código tem 6 números.', 400);

    let fator = corpo.acao === 'confirmar' ? String(corpo.fator || '') : '';
    if (!fator) {
      const { data: lista } = await supabase.auth.mfa.listFactors();
      fator = (lista?.totp || []).find((f) => f.status === 'verified')?.id || '';
    }
    if (!fator) return erro('Ligue o Google Authenticator primeiro.', 400);

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo });
    if (error) return erro('Código errado ou vencido. Use o número que está aparecendo agora no app.', 401);
    return NextResponse.json({ ok: true });
  }

  return erro('Pedido incompleto.', 400);
}
