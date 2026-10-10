import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { apagarModelo, criarModelo, listarModelos, MAX_MODELOS } from '@/lib/modelos';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  return NextResponse.json({ ok: true, modelos: await listarModelos(s.sessao.contaId) });
}

/** salva um modelo novo: { nome, texto } */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('modelo:' + s.sessao.userId, 60, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { nome?: string; texto?: string };
  const nome = String(corpo.nome || '').trim().slice(0, 60);
  const texto = String(corpo.texto || '').trim().slice(0, 1500);
  if (!nome) return NextResponse.json({ ok: false, erro: 'Dê um nome para o modelo.' }, { status: 400 });
  if (texto.length < 10) return NextResponse.json({ ok: false, erro: 'A mensagem está curta demais.' }, { status: 400 });
  const m = await criarModelo(s.sessao.contaId, nome, texto);
  if (m === 'cheio') {
    return NextResponse.json({ ok: false, erro: `Você já tem ${MAX_MODELOS} modelos. Apague um para salvar outro.` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, modelo: m });
}

/** apaga: /api/modelos?id=... */
export async function DELETE(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false, erro: 'Modelo inválido.' }, { status: 400 });
  const ok = await apagarModelo(s.sessao.contaId, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
