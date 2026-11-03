/**
 * Lê as respostas aos e-mails do exterior e move o lead sozinho.
 *
 * A cada rodada (a mesma do envio, de 15 em 15 minutos) abre a caixa de
 * entrada do Gmail do Lucas pelo IMAP, com a mesma senha de app do envio, e
 * olha só as mensagens dos últimos dias. Uma resposta é ligada ao e-mail
 * frio pelo cabeçalho de resposta (In-Reply-To/References) ou, na falta
 * dele, por vir do mesmo endereço para onde mandamos.
 *
 * O que acontece com o lead:
 *  - interessado ou fez pergunta → "negociando" (vai para a coluna do CRM);
 *  - sem interesse → "descartado";
 *  - pediu para sair → descartado e o endereço vai para emails_bloqueados;
 *  - resposta automática (férias, "recebemos sua mensagem") → nada muda;
 *  - e-mail voltou (endereço não existe) → anotado; o lead não muda.
 * Nada é respondido sozinho: responder continua sendo com o Lucas.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { db } from './sql';
import { atualizarLead, buscarLead, type Status } from './db';
import { registrarEvento } from './eventos';
import { bloquear } from './email-frio';
import { perguntarJson, cabecaLigada } from './cabeca';

export type TipoResposta = 'interessado' | 'pergunta' | 'sem_interesse' | 'descadastro' | 'automatica' | 'devolvido' | 'outro';

export const ROTULO_RESPOSTA: Record<TipoResposta, string> = {
  interessado: 'Interessado',
  pergunta: 'Fez uma pergunta',
  sem_interesse: 'Sem interesse',
  descadastro: 'Pediu para não receber',
  automatica: 'Resposta automática',
  devolvido: 'E-mail voltou',
  outro: 'Respondeu',
};

const NOVO_STATUS: Partial<Record<TipoResposta, Status>> = {
  interessado: 'negociando',
  pergunta: 'negociando',
  sem_interesse: 'descartado',
  descadastro: 'descartado',
};

const DIAS = 5;

interface Enviado {
  id: string;
  conta_id: string;
  lead_id: string;
  para: string;
  message_id: string | null;
  enviado_em: Date;
}

const limparId = (s: string) => s.trim().replace(/^<|>$/g, '').toLowerCase();

/** o que a resposta quer dizer, em uma palavra e uma frase em português */
export async function entender(texto: string, assunto: string): Promise<{ tipo: TipoResposta; resumo: string }> {
  const t = texto.slice(0, 2500);
  // atalhos claros, sem gastar a IA
  if (/^\s*(no thanks|no thank you|unsubscribe|remove me|stop|not interested)\b/i.test(t)) {
    return { tipo: /unsubscribe|remove me|stop/i.test(t) ? 'descadastro' : 'sem_interesse', resumo: 'Respondeu que não quer.' };
  }
  if (!cabecaLigada()) return { tipo: 'outro', resumo: 'Respondeu (a IA não está ligada para entender a resposta).' };
  try {
    const r = await perguntarJson<{ tipo: TipoResposta; resumo: string }>(
      `You classify a reply to a cold email that offered a website to a local business. Categories:
- "interessado": wants to talk, asks for a call, a quote, a price, says yes or maybe.
- "pergunta": asks something (who are you, how does it work, how much) without saying yes or no.
- "sem_interesse": says no, already has someone, not now, not interested.
- "descadastro": asks to stop emailing, remove them, unsubscribe, or is angry about being contacted.
- "automatica": an automatic reply (out of office, "we received your message", ticket number).
- "outro": anything else.
Return JSON {"tipo": "...", "resumo": "..."} where resumo is ONE short sentence in Brazilian Portuguese saying what they said.`,
      `Subject: ${assunto}\n\nReply:\n${t}`,
      { type: 'object', properties: { tipo: { type: 'string' }, resumo: { type: 'string' } }, required: ['tipo', 'resumo'] },
    );
    const tipo = (['interessado', 'pergunta', 'sem_interesse', 'descadastro', 'automatica', 'outro'] as TipoResposta[]).includes(r.dados.tipo) ? r.dados.tipo : 'outro';
    return { tipo, resumo: String(r.dados.resumo || '').slice(0, 300) };
  } catch {
    return { tipo: 'outro', resumo: 'Respondeu (não consegui entender a resposta agora).' };
  }
}

/** só o texto novo da resposta, sem o e-mail original citado embaixo */
function semCitacao(texto: string): string {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const corte = linhas.findIndex((l) => /^On .+wrote:\s*$/i.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From: /i.test(l) || /^>/.test(l));
  return (corte > 0 ? linhas.slice(0, corte) : linhas).join('\n').trim();
}

/** só confere se o Gmail aceita o login do IMAP (para o teste da instalação) */
export async function conferirImap(): Promise<{ caixa: number }> {
  const imap = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: process.env.GMAIL_USUARIO!, pass: process.env.GMAIL_SENHA_APP! }, logger: false });
  await imap.connect();
  try {
    const st = await imap.status('INBOX', { messages: true });
    return { caixa: st && typeof st === 'object' ? (st.messages ?? 0) : 0 };
  } finally {
    await imap.logout().catch(() => {});
  }
}

export async function lerRespostas(): Promise<{ lidas: number; ligadas: number; erros: string[] }> {
  const usuario = process.env.GMAIL_USUARIO;
  const senha = process.env.GMAIL_SENHA_APP;
  if (!usuario || !senha) return { lidas: 0, ligadas: 0, erros: ['gmail desligado'] };

  const enviados = (await db()`
    select id, conta_id, lead_id, para, message_id, enviado_em from emails_frios
    where status = 'enviado' and enviado_em > now() - interval '45 days'
  `) as unknown as Enviado[];
  if (!enviados.length) return { lidas: 0, ligadas: 0, erros: [] };
  const porId = new Map(enviados.filter((e) => e.message_id).map((e) => [limparId(e.message_id!), e]));
  const porEndereco = new Map(enviados.map((e) => [e.para.toLowerCase(), e]));

  const imap = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: usuario, pass: senha }, logger: false });
  const erros: string[] = [];
  let lidas = 0;
  let ligadas = 0;
  await imap.connect();
  const trava = await imap.getMailboxLock('INBOX');
  try {
    const desde = new Date(Date.now() - DIAS * 86400_000);
    const uids = (await imap.search({ since: desde }, { uid: true })) || [];
    // as mais recentes primeiro; no máximo 60 por rodada
    for (const uid of uids.slice(-60).reverse()) {
      const m = await imap.fetchOne(String(uid), { source: true }, { uid: true });
      if (!m || !m.source) continue;
      lidas++;
      const msg = await simpleParser(m.source);
      const mid = msg.messageId ? limparId(msg.messageId) : `uid-${uid}`;
      const [ja] = await db()`select 1 from emails_respostas where message_id = ${mid}`;
      if (ja) continue;
      const de = (msg.from?.value?.[0]?.address || '').toLowerCase();
      if (!de || de === usuario.toLowerCase()) continue;

      // e-mail que voltou: o servidor avisa qual endereço falhou
      const falhou = String(msg.headers.get('x-failed-recipients') || '').toLowerCase().trim();
      const devolucao = /mailer-daemon|postmaster/i.test(de) && falhou;

      const refs = [msg.inReplyTo, ...(Array.isArray(msg.references) ? msg.references : msg.references ? [msg.references] : [])]
        .filter(Boolean)
        .map((r) => limparId(String(r)));
      const alvo = (devolucao ? porEndereco.get(falhou) : null) || refs.map((r) => porId.get(r)).find(Boolean) || porEndereco.get(de);
      if (!alvo || (msg.date && msg.date < alvo.enviado_em)) continue;

      const automatico = /auto-replied|auto-generated/i.test(String(msg.headers.get('auto-submitted') || '')) || /out of office|automatic reply|autoreply|auto-reply/i.test(msg.subject || '');
      const texto = semCitacao(msg.text || '');
      const { tipo, resumo } = devolucao
        ? { tipo: 'devolvido' as TipoResposta, resumo: 'O e-mail voltou: o endereço não existe ou não recebe mensagens.' }
        : automatico
          ? { tipo: 'automatica' as TipoResposta, resumo: 'Resposta automática (férias ou recebimento).' }
          : await entender(texto, msg.subject || '');

      try {
        await db()`
          insert into emails_respostas (message_id, email_frio_id, conta_id, lead_id, de, assunto, trecho, tipo, resumo, recebida_em)
          values (${mid}, ${alvo.id}, ${alvo.conta_id}, ${alvo.lead_id}, ${de}, ${(msg.subject || '').slice(0, 200)}, ${texto.slice(0, 1500)}, ${tipo}, ${resumo}, ${msg.date || new Date()})
          on conflict (message_id) do nothing
        `;
        // resposta automática não apaga uma resposta de verdade que já veio
        if (tipo !== 'automatica') {
          await db()`update emails_frios set respondido_em = ${msg.date || new Date()}, resposta_tipo = ${tipo}, resposta_resumo = ${resumo} where id = ${alvo.id}`;
        }
        await registrarEvento(alvo.conta_id, alvo.lead_id, 'email', `${ROTULO_RESPOSTA[tipo]}: ${resumo}`, null);
        if (tipo === 'descadastro') await bloquear(alvo.para, 'resposta');
        const novo = NOVO_STATUS[tipo];
        if (novo) {
          const lead = await buscarLead(alvo.conta_id, alvo.lead_id);
          // nunca puxa para trás quem você já moveu à frente (negociando, fechado)
          if (lead && ['novo', 'contatado'].includes(lead.status)) await atualizarLead(alvo.conta_id, alvo.lead_id, { status: novo }, null);
        }
        ligadas++;
      } catch (e) {
        erros.push(e instanceof Error ? e.message.slice(0, 120) : String(e));
      }
    }
  } finally {
    trava.release();
    await imap.logout().catch(() => {});
  }
  return { lidas, ligadas, erros };
}
