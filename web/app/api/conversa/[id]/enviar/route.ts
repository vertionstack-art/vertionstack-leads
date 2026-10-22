import { NextResponse } from 'next/server';
import { atualizarLead, buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { registrarEvento } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { numeroWhatsapp } from '@/lib/telefone';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { passosFeitos, registrarMensagem } from '@/lib/conversa';
import { enviarTexto, ErroEvolution } from '@/lib/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Envia UMA mensagem pelo WhatsApp da Vertion, porque a pessoa clicou em
 * "Enviar". Não existe fila nem envio programado: cada chamada é um clique.
 * { texto, passo? }
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  // ritmo de quem clica, não de robô
  if (await estourou('enviar-zap:' + s.sessao.userId, 12, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitos envios seguidos. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome: quem } = s.sessao;
  const { id } = await ctx.params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const lead = await buscarLead(contaId, idLead);
  if (!lead) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });

  const corpo = (await req.json().catch(() => ({}))) as { texto?: string; passo?: string };
  const texto = String(corpo.texto || '').trim().slice(0, 2000);
  if (!texto) return NextResponse.json({ ok: false, erro: 'A mensagem está vazia.' }, { status: 400 });
  if (/\[[^\]]+\]/.test(texto)) {
    return NextResponse.json({ ok: false, erro: 'Troque o que está [entre colchetes] antes de enviar.' }, { status: 400 });
  }
  const numero = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));
  if (!numero) return NextResponse.json({ ok: false, erro: 'Este lead não tem celular com WhatsApp.' }, { status: 400 });

  let enviado;
  try {
    enviado = await enviarTexto(numero, texto);
  } catch (e) {
    const status = e instanceof ErroEvolution ? e.status : 502;
    return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : 'Não consegui enviar.' }, { status });
  }

  const m = await registrarMensagem(contaId, idLead, 'eu', texto, corpo.passo ? String(corpo.passo).slice(0, 40) : null, enviado.id);
  await registrarEvento(contaId, idLead, 'whatsapp', `WhatsApp enviado pela ferramenta: “${texto.replace(/\s+/g, ' ').slice(0, 160)}${texto.length > 160 ? '…' : ''}”`, quem);
  await db()`update leads set contatado_em = coalesce(contatado_em, now()) where conta_id = ${contaId} and id = ${idLead}`;
  if (lead.status === 'novo') await atualizarLead(contaId, idLead, { status: 'contatado' }, quem);

  return NextResponse.json({
    ok: true,
    mensagem: typeof m === 'object' ? m : null,
    passos: await passosFeitos(contaId, idLead),
  });
}
