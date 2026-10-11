import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { db } from '@/lib/sql';
import { OFERTAS, PUBLICOS } from '@/lib/ofertas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** grava "o que você vende" da conta: { oferta, texto, publico[], negocio } */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const corpo = (await req.json().catch(() => ({}))) as { oferta?: string; texto?: string; publico?: unknown; negocio?: string };
  const oferta = OFERTAS.find((o) => o.id === corpo.oferta)?.id;
  if (!oferta) return NextResponse.json({ ok: false, erro: 'Escolha o que você vende.' }, { status: 400 });
  const texto = String(corpo.texto || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null;
  if (oferta === 'outro' && (!texto || texto.length < 4)) {
    return NextResponse.json({ ok: false, erro: 'Conte em uma frase o que você vende.' }, { status: 400 });
  }
  const publico = Array.isArray(corpo.publico) ? corpo.publico.filter((p): p is string => PUBLICOS.some((x) => x.id === p)) : [];
  const negocio = String(corpo.negocio || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  await db()`
    update contas set
      oferta = ${oferta},
      oferta_texto = ${oferta === 'outro' ? texto : null},
      oferta_publico = ${publico},
      -- o nome do negócio é o mesmo "nome da empresa" de Meu perfil; só o dono muda
      empresa_nome = case when ${s.sessao.papel === 'dono' && negocio !== ''} then ${negocio} else empresa_nome end
    where id = ${s.sessao.contaId}
  `;
  return NextResponse.json({ ok: true });
}
