import { NextResponse } from 'next/server';
import { db } from '@/lib/sql';
import { atualizarLead, buscarLead } from '@/lib/db';
import { registrarEvento } from '@/lib/eventos';
import { dentroDaJanela, enviadosHoje, estaBloqueado, gmailLigado, mandarPeloGmail, tetoPorDia } from '@/lib/email-frio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** quantos saem por rodada: a rodada é a cada 15 min, então a janela de 2h30 solta até ~30 */
const POR_RODADA = 3;

/**
 * Manda os e-mails aprovados cujo horário comercial de lá está aberto.
 * Chamado a cada 15 minutos pelo GitHub Actions (.github/workflows/emails.yml)
 * com o CRON_SECRET no cabeçalho; sem ele, ninguém de fora dispara envio.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!gmailLigado()) return NextResponse.json({ ok: true, enviados: 0, motivo: 'gmail desligado' });

  const restam = tetoPorDia() - (await enviadosHoje());
  if (restam <= 0) return NextResponse.json({ ok: true, enviados: 0, motivo: 'teto do dia' });

  const fila = await db()`select id, conta_id, lead_id, para, assunto, corpo, fuso from emails_frios where status = 'aprovado' order by aprovado_em asc limit 100`;
  const agora = fila.filter((e) => dentroDaJanela(e.fuso as string)).slice(0, Math.min(POR_RODADA, restam));

  let enviados = 0;
  const erros: string[] = [];
  for (const e of agora) {
    // trava a linha: se duas rodadas se cruzarem, só uma manda
    const [pegou] = await db()`update emails_frios set status = 'enviando' where id = ${e.id} and status = 'aprovado' returning id`;
    if (!pegou) continue;
    if (await estaBloqueado(e.para as string)) {
      await db()`update emails_frios set status = 'cancelado', erro = 'Pediu para não receber' where id = ${e.id}`;
      continue;
    }
    try {
      const messageId = await mandarPeloGmail(e.para as string, e.assunto as string, e.corpo as string);
      await db()`update emails_frios set status = 'enviado', enviado_em = now(), message_id = ${messageId}, erro = null where id = ${e.id}`;
      enviados++;
      const conta = e.conta_id as string;
      const leadId = e.lead_id as string;
      await registrarEvento(conta, leadId, 'email', `E-mail enviado: “${String(e.assunto).slice(0, 120)}”`, null);
      await db()`update leads set contatado_em = coalesce(contatado_em, now()) where conta_id = ${conta} and id = ${leadId}`;
      const lead = await buscarLead(conta, leadId);
      if (lead?.status === 'novo') await atualizarLead(conta, leadId, { status: 'contatado' }, null);
    } catch (x) {
      const msg = x instanceof Error ? x.message : String(x);
      const login = /Invalid login|Username and Password not accepted|535|534/i.test(msg);
      await db()`update emails_frios set status = ${login ? 'aprovado' : 'erro'}, erro = ${login ? 'O Gmail recusou a senha de app. Confira GMAIL_SENHA_APP na Vercel.' : msg.slice(0, 300)} where id = ${e.id}`;
      erros.push(msg.slice(0, 120));
      // senha errada vale para todos: não adianta tentar os outros
      if (login) break;
    }
  }
  return NextResponse.json({ ok: true, enviados, naJanela: agora.length, naFila: fila.length, erros });
}
