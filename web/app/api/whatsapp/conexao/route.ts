import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { origemDoSite } from '@/lib/porta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { conectarWhatsapp, desconectarWhatsapp, ErroEvolution, estadoDoWhatsapp } from '@/lib/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function entrar(req: Request | null) {
  if (req && !origemConfere(req)) return { erro: recusarOrigem() };
  const s = await exigirSessao();
  if (s.erro) return { erro: s.erro };
  if (!podeUsarConversa(s.sessao.email)) return { erro: NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 }) };
  if (req && (await estourou('conexao-zap:' + s.sessao.userId, 20, 60))) {
    return { erro: NextResponse.json({ ok: false, erro: 'Muitas tentativas. Espere um minuto.' }, { status: 429 }) };
  }
  return { ok: true };
}

function falha(e: unknown) {
  const status = e instanceof ErroEvolution ? e.status : 502;
  return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : 'O WhatsApp não respondeu.' }, { status });
}

/** o WhatsApp está conectado? */
export async function GET() {
  const e = await entrar(null);
  if (e.erro) return e.erro;
  try {
    return NextResponse.json({ ok: true, estado: await estadoDoWhatsapp() });
  } catch (x) {
    return falha(x);
  }
}

/** { acao: 'conectar' } devolve o QR code; { acao: 'desconectar' } tira o número da ferramenta */
export async function POST(req: Request) {
  const e = await entrar(req);
  if (e.erro) return e.erro;
  const corpo = (await req.json().catch(() => ({}))) as { acao?: string };
  try {
    if (corpo.acao === 'desconectar') {
      await desconectarWhatsapp();
      return NextResponse.json({ ok: true, estado: 'close' });
    }
    const r = await conectarWhatsapp(origemDoSite(req) + '/api/whatsapp/webhook');
    return NextResponse.json({ ok: true, ...r });
  } catch (x) {
    return falha(x);
  }
}
