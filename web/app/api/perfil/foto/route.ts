import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { salvarFoto, validarFoto } from '@/lib/perfil';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** troca a foto de perfil de quem está logado — só a própria, nunca a de outra pessoa */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('foto:' + s.sessao.userId, 20, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Trocas demais em pouco tempo. Espere um pouco.' }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { foto?: string };
  const foto = validarFoto(corpo.foto);
  if (!foto) return NextResponse.json({ ok: false, erro: 'Essa imagem não deu certo. Use uma foto JPG ou PNG.' }, { status: 400 });
  await salvarFoto(s.sessao.contaId, s.sessao.userId, foto);
  return NextResponse.json({ ok: true, foto });
}

export async function DELETE(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  await salvarFoto(s.sessao.contaId, s.sessao.userId, null);
  return NextResponse.json({ ok: true, foto: null });
}
