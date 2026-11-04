/**
 * Mandar um e-mail aprovado, de fato. Usado pela rodada do cron e pelo
 * "Enviar agora" da tela: as mesmas travas nos dois caminhos.
 *
 * Quando sai: por padrão, no horário comercial de lá (enviar_em vazio). O
 * Lucas pode escolher outro jeito ao aprovar (lib/email-frio-fila,
 * QUANDO_ENVIAR): agora, daqui a 5 minutos, ou espaçado de 5 em 5 / 10 em
 * 10 minutos. Aí enviar_em guarda a hora marcada, e quem dispara na hora
 * certa é o pg_cron do Supabase (migração 0037), que chama a rota do cron
 * a cada minuto só quando há algum e-mail vencido.
 */

import { db } from './sql';
import { atualizarLead, buscarLead } from './db';
import { registrarEvento } from './eventos';
import { comDemo, demoValida, estaBloqueado, mandarPeloGmail } from './email-frio';

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; loginRecusado?: boolean; pulado?: boolean };

export async function enviarUm(id: string): Promise<ResultadoEnvio> {
  // trava a linha: se duas rodadas se cruzarem, só uma manda
  const [e] = await db()`update emails_frios set status = 'enviando' where id = ${id} and status = 'aprovado' returning id, conta_id, lead_id, para, assunto, corpo, demo_url`;
  if (!e) return { ok: false, erro: 'Esse e-mail já saiu ou não está aprovado.', pulado: true };
  if (await estaBloqueado(e.para as string)) {
    await db()`update emails_frios set status = 'cancelado', erro = 'Pediu para não receber' where id = ${id}`;
    return { ok: false, erro: 'Esse endereço pediu para não receber mais.' };
  }
  const demo = demoValida(e.demo_url);
  if (!demo) {
    await db()`update emails_frios set status = 'rascunho', erro = 'Falta o link da demo. Cole o link e aprove de novo.' where id = ${id}`;
    return { ok: false, erro: 'Falta o link da demo.' };
  }
  try {
    const messageId = await mandarPeloGmail(e.para as string, e.assunto as string, comDemo(e.corpo as string, demo));
    await db()`update emails_frios set status = 'enviado', enviado_em = now(), message_id = ${messageId}, erro = null where id = ${id}`;
    const conta = e.conta_id as string;
    const leadId = e.lead_id as string;
    await registrarEvento(conta, leadId, 'email', `E-mail enviado: “${String(e.assunto).slice(0, 120)}”`, null);
    await db()`update leads set contatado_em = coalesce(contatado_em, now()) where conta_id = ${conta} and id = ${leadId}`;
    const lead = await buscarLead(conta, leadId);
    if (lead?.status === 'novo') await atualizarLead(conta, leadId, { status: 'contatado' }, null);
    return { ok: true };
  } catch (x) {
    const msg = x instanceof Error ? x.message : String(x);
    const login = /Invalid login|Username and Password not accepted|535|534/i.test(msg);
    await db()`update emails_frios set status = ${login ? 'aprovado' : 'erro'}, erro = ${login ? 'O Gmail recusou a senha de app. Confira GMAIL_SENHA_APP na Vercel.' : msg.slice(0, 300)} where id = ${id}`;
    return { ok: false, erro: msg.slice(0, 200), loginRecusado: login };
  }
}
