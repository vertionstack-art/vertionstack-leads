/**
 * Os e-mails automáticos para o dono da ferramenta.
 *
 * - proposta aceita: o cliente aceitou pelo link (na hora);
 * - resumo da semana: toda segunda, no aviso das 9h (app/api/cron/avisos).
 *
 * Os e-mails de assinante (boas-vindas, teste grátis, plano vencendo, compra
 * pela metade) saíram em 21/11/2026, quando a ferramenta ficou só do Lucas.
 * Cada aviso sai uma vez por motivo (tabela emails_enviados). Se o envio
 * falhar, a marca é desfeita e o próximo disparo tenta de novo.
 */

import { db } from './sql';
import { enviarEmail, emailLigado, linkSair, SITE, type Mensagem } from './email';

const primeiroNome = (s: string | null | undefined) => {
  const p = (s || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
};

/** marca, envia e desfaz a marca se o envio falhar; devolve se saiu */
async function enviarUmaVez(conta: string, tipo: string, chave: string, para: string, assunto: string, m: Mensagem): Promise<boolean> {
  if (!emailLigado()) return false;
  const sql = db();
  const marcado = await sql`
    insert into emails_enviados (conta_id, tipo, chave) values (${conta}, ${tipo}, ${chave})
    on conflict do nothing returning id
  `;
  if (!marcado.length) return false;
  const ok = await enviarEmail(para, assunto, m);
  if (!ok) await sql`delete from emails_enviados where id = ${marcado[0].id}`;
  return ok;
}

async function donos(contas: string[]): Promise<Map<string, { email: string; nome: string }>> {
  if (!contas.length) return new Map();
  const r = await db()`select conta_id, email, nome from public.emails_dos_donos(${contas}::uuid[])`;
  return new Map(r.map((x) => [x.conta_id as string, { email: x.email as string, nome: x.nome as string }]));
}

/** o cliente aceitou a proposta pelo link: avisa na hora quem mandou */
export async function avisarAceite(conta: string, comercio: string, quem: string, entrada: number, mensalidade: number): Promise<void> {
  try {
    const d = (await donos([conta])).get(conta);
    if (!d || !emailLigado()) return;
    const valor = entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const mensal = mensalidade > 0 ? ` + ${mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por mês` : '';
    await enviarEmail(d.email, `${comercio} aceitou sua proposta`, {
      previa: `${quem} aceitou agora: ${valor}${mensal}.`,
      titulo: `${comercio} aceitou sua proposta.`,
      paragrafos: [
        `**${quem}** aceitou a proposta pelo link agora, no valor de **${valor}${mensal}**.`,
        'O lead já foi para "Fechado" no CRM e entrou no seu Financeiro. O próximo passo é combinar a entrada e pedir o material (logo, fotos e textos).',
      ],
      botao: { texto: 'Abrir o CRM', url: `${SITE}/crm` },
    });
  } catch (e) {
    console.error('[aviso aceite]', e);
  }
}

// ------------------------------------------------- resumo da semana

/**
 * Toda segunda (no aviso diário): o que cada conta fez nos últimos 7 dias e
 * o que tem para a semana. Só vai para quem teve movimento ou tem lembrete,
 * e respeita o "não quero receber" (contas.emails_aviso).
 */
export async function rodarResumoSemanal(): Promise<number> {
  if (!emailLigado()) return 0;
  const brasilia = new Date(Date.now() - 3 * 3600 * 1000);
  if (brasilia.getUTCDay() !== 1) return 0; // segunda-feira
  const semana = brasilia.toISOString().slice(0, 10);
  const sql = db();
  const contas = await sql`
    select c.id from contas c
    where c.emails_aviso and not c.bloqueada
      and exists (select 1 from leads l where l.conta_id = c.id)
  `;
  const quem = await donos(contas.map((c) => c.id as string));
  let enviados = 0;
  for (const c of contas) {
    const d = quem.get(c.id as string);
    if (!d) continue;
    const [n] = await sql`
      select
        (select count(*)::int from leads where conta_id = ${c.id} and created_at > now() - interval '7 days') as novos,
        (select count(*)::int from lead_eventos where conta_id = ${c.id} and tipo = 'whatsapp' and criado_em > now() - interval '7 days') as conversas,
        (select count(*)::int from lead_eventos where conta_id = ${c.id} and tipo = 'proposta' and criado_em > now() - interval '7 days') as propostas,
        (select count(*)::int from lead_eventos where conta_id = ${c.id} and tipo = 'proposta_aberta' and criado_em > now() - interval '7 days') as abertas,
        (select count(*)::int from lead_eventos where conta_id = ${c.id} and tipo = 'proposta_fechada' and criado_em > now() - interval '7 days') as fechadas,
        (select count(*)::int from leads where conta_id = ${c.id} and lembrete_em is not null and lembrete_em < now() + interval '7 days') as lembretes,
        (select count(*)::int from leads where conta_id = ${c.id} and status = 'novo' and is_lead and phone is not null) as esperando
    `;
    const movimento = n.novos + n.conversas + n.propostas + n.abertas + n.fechadas;
    if (!movimento && !n.lembretes) continue;
    const nome = primeiroNome(d.nome);
    const linhas = [
      `**${n.novos}** ${n.novos === 1 ? 'comércio novo' : 'comércios novos'} na sua lista`,
      `**${n.conversas}** ${n.conversas === 1 ? 'conversa começada' : 'conversas começadas'} no WhatsApp`,
      `**${n.propostas}** ${n.propostas === 1 ? 'proposta montada' : 'propostas montadas'}, **${n.abertas}** ${n.abertas === 1 ? 'abertura' : 'aberturas'} pelos clientes`,
      `**${n.fechadas}** ${n.fechadas === 1 ? 'venda fechada' : 'vendas fechadas'}`,
    ];
    const proximo = n.lembretes
      ? `Para esta semana você tem **${n.lembretes} ${n.lembretes === 1 ? 'lembrete' : 'lembretes'}** no CRM.`
      : `Você tem **${n.esperando} ${n.esperando === 1 ? 'comércio' : 'comércios'}** com telefone esperando o primeiro contato. Comece pelos quentes.`;
    const ok = await enviarUmaVez(c.id as string, 'resumo_semanal', semana, d.email, 'Sua semana no Vertion Leads', {
      previa: `${n.novos} leads novos, ${n.fechadas} vendas fechadas.`,
      titulo: nome ? `${nome}, a sua semana.` : 'A sua semana.',
      paragrafos: ['Nos últimos 7 dias:', ...linhas.map((l) => `• ${l}`), proximo],
      botao: { texto: n.lembretes ? 'Ver o que fazer hoje' : 'Abrir o painel', url: n.lembretes ? `${SITE}/crm#para-hoje` : SITE },
      sair: linkSair(c.id as string),
    });
    if (ok) enviados++;
  }
  return enviados;
}
