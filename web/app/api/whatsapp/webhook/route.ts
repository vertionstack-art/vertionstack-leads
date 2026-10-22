import { NextResponse } from 'next/server';
import { estourou } from '@/lib/limite';
import { ipDaRequisicao } from '@/lib/acessos';
import { registrarEvento } from '@/lib/eventos';
import { contaDaConversa, leadPeloNumero, registrarMensagem } from '@/lib/conversa';
import { lerMensagemRecebida, segredoDoWebhookConfere, variantesDoNumero } from '@/lib/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O servidor da Evolution API avisa aqui cada mensagem nova do WhatsApp da
 * Vertion. Só entra quem traz o segredo (cabeçalho x-vertion-segredo).
 *
 * A mensagem só é guardada quando o número é de um lead da conta: conversa
 * com amigo, cliente antigo ou grupo é ignorada e não fica salva em lugar
 * nenhum. As enviadas pelo próprio celular também entram (autor "eu"), e as
 * enviadas pela ferramenta não duplicam (mesmo id do WhatsApp).
 */
export async function POST(req: Request) {
  if (!segredoDoWebhookConfere(req.headers.get('x-vertion-segredo'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (await estourou('zap-webhook:' + ipDaRequisicao(req), 600, 60)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const evento = await req.json().catch(() => null);
  const msg = lerMensagemRecebida(evento);
  if (!msg) return NextResponse.json({ ok: true, ignorada: true });

  const conta = await contaDaConversa();
  if (!conta) return NextResponse.json({ ok: true, ignorada: true });
  const lead = await leadPeloNumero(conta, variantesDoNumero(msg.numero));
  if (!lead) return NextResponse.json({ ok: true, ignorada: true });

  const r = await registrarMensagem(conta, lead, msg.deMim ? 'eu' : 'cliente', msg.texto, null, msg.id);
  if (typeof r === 'object' && !msg.deMim) {
    await registrarEvento(conta, lead, 'whatsapp', `Respondeu no WhatsApp: “${msg.texto.replace(/\s+/g, ' ').slice(0, 160)}”`, msg.nome);
  }
  return NextResponse.json({ ok: true });
}
