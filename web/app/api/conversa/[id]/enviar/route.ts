import { NextResponse } from 'next/server';
import { atualizarLead, buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { registrarEvento } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { numeroWhatsapp } from '@/lib/telefone';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { origemIaValida, passosFeitos, registrarMensagem, type MensagemConversa } from '@/lib/conversa';
import { partesDaMensagem, tempoDigitando } from '@/lib/partes';
import { enviarTexto, ErroEvolution } from '@/lib/evolution';
import { aoMandarPorContaPropria } from '@/lib/robo';
import { LIMITE_PRIMEIRAS_POR_DIA, primeirasHoje, semConversa } from '@/lib/fila';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Envia a mensagem pelo WhatsApp da Vertion, porque a pessoa clicou em
 * "Enviar". Não existe envio programado: cada chamada é um clique. A
 * primeira mensagem para um lead sai em até 3 partes (lib/partes).
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

  const corpo = (await req.json().catch(() => ({}))) as { texto?: string; passo?: string; origemIa?: string };
  const texto = String(corpo.texto || '').trim().slice(0, 2000);
  if (!texto) return NextResponse.json({ ok: false, erro: 'A mensagem está vazia.' }, { status: 400 });
  if (/\[[^\]]+\]/.test(texto)) {
    return NextResponse.json({ ok: false, erro: 'Troque o que está [entre colchetes] antes de enviar.' }, { status: 400 });
  }
  const numero = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));
  if (!numero) return NextResponse.json({ ok: false, erro: 'Este lead não tem celular com WhatsApp.' }, { status: 400 });

  // primeira mensagem para quem nunca falou com você: teto por dia, valendo aqui no servidor
  const primeira = await semConversa(contaId, idLead);
  if (primeira && (await primeirasHoje(contaId)) >= LIMITE_PRIMEIRAS_POR_DIA) {
    return NextResponse.json(
      { ok: false, erro: `Você já abriu ${LIMITE_PRIMEIRAS_POR_DIA} conversas hoje. Esse é o limite para proteger o número; amanhã libera de novo.` },
      { status: 429 },
    );
  }

  /*
   * A primeira mensagem sai picada (lib/partes): cada bloco separado por
   * linha em branco vira uma mensagem, com "digitando..." antes. Continua
   * sendo um clique seu e conta como uma conversa aberta no teto do dia.
   * Depois da primeira, o texto vai inteiro, do jeito que foi escrito.
   */
  const partes = primeira ? partesDaMensagem(texto) : [texto];
  const passo = corpo.passo ? String(corpo.passo).slice(0, 40) : null;
  const origem = origemIaValida(corpo.origemIa);
  const gravadas: MensagemConversa[] = [];
  for (let i = 0; i < partes.length; i++) {
    let enviado;
    try {
      enviado = await enviarTexto(numero, partes[i], partes.length > 1 ? tempoDigitando(partes[i], i) : 0);
    } catch (e) {
      if (i === 0) {
        const status = e instanceof ErroEvolution ? e.status : 502;
        return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : 'Não consegui enviar.' }, { status });
      }
      // parte do meio falhou: o que já saiu fica registrado, e a pessoa sabe o que faltou
      await aoMandarPorContaPropria(contaId, idLead);
      return NextResponse.json(
        { ok: false, erro: `Saíram ${i} de ${partes.length} mensagens; a parte ${i + 1} não foi. Mande o resto pela conversa.`, mensagens: gravadas },
        { status: 502 },
      );
    }
    const m = await registrarMensagem(contaId, idLead, 'eu', partes[i], i === 0 ? passo : null, enviado.id, false, origem);
    if (typeof m === 'object') gravadas.push(m);
  }
  const m = gravadas[gravadas.length - 1] ?? null;
  await registrarEvento(contaId, idLead, 'whatsapp', `WhatsApp enviado pela ferramenta: “${texto.replace(/\s+/g, ' ').slice(0, 160)}${texto.length > 160 ? '…' : ''}”`, quem);
  await db()`update leads set contatado_em = coalesce(contatado_em, now()) where conta_id = ${contaId} and id = ${idLead}`;
  // primeira mensagem: o robô fica de prontidão; depois de ele já ter falado, você assumiu e ele pausa
  await aoMandarPorContaPropria(contaId, idLead);
  if (lead.status === 'novo') await atualizarLead(contaId, idLead, { status: 'contatado' }, quem);

  return NextResponse.json({
    ok: true,
    mensagem: m,
    mensagens: gravadas,
    passos: await passosFeitos(contaId, idLead),
  });
}
