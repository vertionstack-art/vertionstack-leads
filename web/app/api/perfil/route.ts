import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { lerPerfil, salvarPerfil, validarPerfil } from '@/lib/perfil';
import { cancelarAssinaturaJa, pagamentosDaConta, situacaoDaCobranca } from '@/lib/pagamento';
import { equipeDaConta } from '@/lib/conta';
import { estourou } from '@/lib/limite';
import { db } from '@/lib/sql';
import { supabaseServidor } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, userId, email, papel, plano, pagoAte } = s.sessao;
  const [perfil, equipe, pagamentos, cobranca] = await Promise.all([
    lerPerfil(contaId, userId),
    equipeDaConta(contaId),
    pagamentosDaConta(contaId),
    situacaoDaCobranca(contaId),
  ]);
  return NextResponse.json({ ok: true, email, papel, plano, pagoAte, perfil, equipe, pagamentos, cobranca });
}

export async function PATCH(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('perfil:' + s.sessao.userId, 30, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Alterações demais em pouco tempo. Espere um pouco.' }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validarPerfil(corpo);
  if (!v.ok) return NextResponse.json({ ok: false, erro: v.erro }, { status: 400 });
  await salvarPerfil(s.sessao.contaId, s.sessao.userId, v.perfil, s.sessao.papel === 'dono');
  return NextResponse.json({ ok: true, perfil: await lerPerfil(s.sessao.contaId, s.sessao.userId) });
}

/**
 * Excluir a própria conta. Pede "EXCLUIR" digitado para não acontecer por
 * engano, cancela a assinatura no cartão antes (senão a Stripe continuaria
 * cobrando quem não existe mais) e apaga leads, propostas e o login.
 */
export async function DELETE(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, userId, papel, admin } = s.sessao;

  const corpo = (await req.json().catch(() => ({}))) as { confirmacao?: string };
  if (String(corpo.confirmacao || '').trim().toUpperCase() !== 'EXCLUIR') {
    return NextResponse.json({ ok: false, erro: 'Digite EXCLUIR para confirmar.' }, { status: 400 });
  }
  if (admin) {
    return NextResponse.json(
      { ok: false, erro: 'A conta do administrador não se exclui por aqui: tire o e-mail de ADMIN_EMAILS antes.' },
      { status: 400 },
    );
  }

  const sql = db();
  if (papel === 'dono') {
    const outros = await sql`select count(*)::int as n from membros where conta_id = ${contaId} and user_id <> ${userId}`;
    if (outros[0].n > 0) {
      return NextResponse.json(
        { ok: false, erro: 'Ainda há outras pessoas nesta conta. Fale com o suporte para transferir ou excluir.' },
        { status: 400 },
      );
    }
    try {
      await cancelarAssinaturaJa(contaId);
    } catch {
      return NextResponse.json(
        { ok: false, erro: 'Não consegui cancelar a sua assinatura agora, então a conta não foi excluída. Tente de novo em alguns minutos.' },
        { status: 502 },
      );
    }
    await sql`delete from contas where id = ${contaId}`;
  } else {
    await sql`delete from membros where conta_id = ${contaId} and user_id = ${userId}`;
  }
  await sql`select public.apagar_usuario(${userId})`;

  const supabase = await supabaseServidor();
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
