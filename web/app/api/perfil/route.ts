import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { lerPerfil, salvarPerfil, validarPerfil } from '@/lib/perfil';
import { equipeDaConta } from '@/lib/conta';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, userId, email, papel } = s.sessao;
  const [perfil, equipe] = await Promise.all([lerPerfil(contaId, userId), equipeDaConta(contaId)]);
  return NextResponse.json({ ok: true, email, papel, perfil, equipe });
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
