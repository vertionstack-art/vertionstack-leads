/**
 * Quem chama o WhatsApp da Vertion sem ser lead (veio do Instagram, da
 * landing page, de indicação). Com "Atender quem chamar primeiro" ligado, o
 * número vira lead na hora (origem 'whatsapp') e o robô atende; sem isso, a
 * mensagem é ignorada como antes (amigo, família, conversa pessoal).
 *
 * Proteções: grupos e mensagens que o dono manda do celular nunca criam lead
 * (o webhook já filtra); números marcados em "Ignorar este número" nunca
 * mais viram lead nem recebem robô; no máximo 40 contatos novos por dia.
 */

import { db } from './sql';
import { normalizarLead, salvarLeads } from './db';
import { registrarEvento } from './eventos';
import { estourou } from './limite';
import type { MensagemRecebida } from './evolution';

export const MAX_NOVOS_POR_DIA = 40;

export async function atendeNovos(conta: string): Promise<boolean> {
  const [r] = await db()`select robo_atende_novos from contas where id = ${conta}`;
  return Boolean(r?.robo_atende_novos);
}

export async function ligarAtendeNovos(conta: string, ligado: boolean): Promise<void> {
  await db()`update contas set robo_atende_novos = ${ligado} where id = ${conta}`;
}

/** as formas do número (com e sem 55, com e sem o 9) contra a lista de ignorados */
export async function numeroIgnorado(conta: string, formas: string[]): Promise<boolean> {
  if (!formas.length) return false;
  const r = await db()`select 1 as x from zap_ignorados where conta_id = ${conta} and numero = any(${formas}) limit 1`;
  return r.length > 0;
}

/** "5521999998888" → "(21) 99999-8888" */
function formatado(numero: string): string {
  const d = numero.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero;
}

/**
 * Cria o lead de quem chamou primeiro. Devolve o id, ou null quando não deve
 * criar (atendimento de novos desligado, número ignorado, limite do dia).
 */
export async function leadDeQuemChamou(conta: string, msg: MensagemRecebida, formas: string[]): Promise<string | null> {
  if (msg.deMim) return null;
  if (!(await atendeNovos(conta))) return null;
  if (await numeroIgnorado(conta, formas)) return null;
  if (await estourou(`zap-novos:${conta}`, MAX_NOVOS_POR_DIA, 86400)) return null;

  const numero = msg.numero.replace(/\D/g, '');
  const nome = (msg.nome || '').trim() || `WhatsApp ${formatado(numero)}`;
  const lead = normalizarLead(
    { placeKey: `whatsapp:${numero}`, name: nome, phone: formatado(numero), whatsapp: numero, searchTerm: 'chamou no WhatsApp' },
    'WhatsApp',
    'whatsapp',
  );
  if (!lead) return null;
  // contato que chegou sozinho não gasta a cota de leads
  await salvarLeads(conta, [lead], 1);
  await db()`
    update leads set tipo = 'pessoa', status = 'contatado', contatado_em = coalesce(contatado_em, now()), updated_at = now()
    where conta_id = ${conta} and id = ${lead.id}
  `;
  // o robô fica de prontidão nessa conversa se estiver ligado na conta
  await db()`
    insert into robo_conversas (conta_id, lead_id, ligado)
    select ${conta}, ${lead.id}, robo_ativo from contas where id = ${conta}
    on conflict do nothing
  `;
  await registrarEvento(conta, lead.id, 'nota', 'Chamou no WhatsApp da Vertion (novo contato, não veio da busca)', 'WhatsApp');
  return lead.id;
}

/**
 * "Ignorar este número": o robô para nessa conversa, o lead vai para
 * descartado e o número nunca mais vira lead nem recebe robô.
 */
export async function ignorarNumero(conta: string, leadId: string, quem: string | null): Promise<boolean> {
  const [l] = await db()`select whatsapp, phone from leads where conta_id = ${conta} and id = ${leadId}`;
  if (!l) return false;
  const numeros = [...new Set([l.whatsapp, l.phone].map((x) => String(x || '').replace(/\D/g, '')).filter((x) => x.length >= 10))];
  const formas = numeros.flatMap((n) => {
    const sem55 = n.startsWith('55') && n.length >= 12 ? n.slice(2) : n;
    const variantes = [sem55, '55' + sem55];
    if (sem55.length === 11 && sem55[2] === '9') variantes.push(sem55.slice(0, 2) + sem55.slice(3), '55' + sem55.slice(0, 2) + sem55.slice(3));
    return variantes;
  });
  for (const n of new Set(formas)) {
    await db()`insert into zap_ignorados (conta_id, numero) values (${conta}, ${n}) on conflict do nothing`;
  }
  await db()`update robo_conversas set ligado = false, pausado_motivo = 'você marcou para ignorar este número' where conta_id = ${conta} and lead_id = ${leadId}`;
  await db()`update leads set status = 'descartado', updated_at = now() where conta_id = ${conta} and id = ${leadId}`;
  await registrarEvento(conta, leadId, 'nota', 'Número ignorado: o robô não responde mais e ele não vira lead de novo', quem);
  return true;
}
