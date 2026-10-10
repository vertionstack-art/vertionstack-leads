/**
 * Histórico e lembrete de cada lead.
 *
 * O histórico é a linha do tempo da ficha: mudou de status, mandou WhatsApp,
 * salvou proposta, o cliente abriu, mudou de etapa no CRM. Cada linha é uma
 * frase pronta para mostrar, para a tela não precisar adivinhar nada. O
 * "entrou na lista" não é gravado: vem do created_at do próprio lead.
 *
 * Gravar histórico nunca pode derrubar a ação principal: se a linha não
 * entrar, a mudança no lead continua valendo e o erro só vai para o log.
 */

import { db } from './sql';

export type TipoEvento =
  | 'status'
  | 'nota'
  | 'whatsapp'
  | 'proposta'
  | 'proposta_fechada'
  | 'proposta_aberta'
  | 'previa'
  | 'etapa'
  | 'lembrete'
  | 'lembrete_feito';

export interface Evento {
  id: string;
  tipo: TipoEvento | 'criado';
  detalhe: string | null;
  quem: string | null;
  em: string;
}

const ROTULO_STATUS: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  negociando: 'Negociando',
  fechado: 'Fechado',
  descartado: 'Descartado',
};

export const rotuloDoStatus = (s: string) => ROTULO_STATUS[s] || s;

export async function registrarEvento(
  conta: string,
  leadId: string,
  tipo: TipoEvento,
  detalhe: string | null,
  quem: string | null,
): Promise<void> {
  try {
    await db()`
      insert into lead_eventos (conta_id, lead_id, tipo, detalhe, quem)
      values (${conta}, ${leadId}, ${tipo}, ${detalhe ? detalhe.slice(0, 500) : null}, ${quem})
    `;
  } catch (e) {
    console.error('[evento]', tipo, e);
  }
}

/** a mesma linha para vários leads de uma vez (mover vários cards no CRM) */
export async function registrarEventos(
  conta: string,
  leadIds: string[],
  tipo: TipoEvento,
  detalhe: string | null,
  quem: string | null,
): Promise<void> {
  if (!leadIds.length) return;
  try {
    await db()`
      insert into lead_eventos (conta_id, lead_id, tipo, detalhe, quem)
      select ${conta}, x, ${tipo}, ${detalhe}, ${quem} from unnest(${leadIds}::text[]) as x
    `;
  } catch (e) {
    console.error('[evento]', tipo, e);
  }
}

export async function historicoDoLead(conta: string, leadId: string): Promise<Evento[]> {
  const sql = db();
  const [lead] = await sql`select created_at, origem from leads where conta_id = ${conta} and id = ${leadId}`;
  if (!lead) return [];
  const linhas = await sql`
    select id, tipo, detalhe, quem, criado_em from lead_eventos
    where conta_id = ${conta} and lead_id = ${leadId}
    order by criado_em desc, id desc
    limit 200
  `;
  const eventos: Evento[] = linhas.map((r) => ({
    id: String(r.id),
    tipo: r.tipo as TipoEvento,
    detalhe: r.detalhe as string | null,
    quem: r.quem as string | null,
    em: new Date(r.criado_em).toISOString(),
  }));
  eventos.push({
    id: 'criado',
    tipo: 'criado',
    detalhe: lead.origem === 'manual' ? 'Cadastrado à mão' : 'Entrou na lista pela busca',
    quem: null,
    em: new Date(lead.created_at).toISOString(),
  });
  return eventos;
}

// ------------------------------------------------------------ lembrete

export interface Lembrete {
  leadId: string;
  nome: string;
  categoria: string | null;
  em: string;
  texto: string | null;
  /** já passou da hora */
  atrasado: boolean;
}

export async function definirLembrete(
  conta: string,
  leadId: string,
  em: Date | null,
  texto: string | null,
  quem: string | null,
): Promise<boolean> {
  const sql = db();
  const [antes] = await sql`select lembrete_em from leads where conta_id = ${conta} and id = ${leadId}`;
  if (!antes) return false;
  await sql`
    update leads set lembrete_em = ${em}, lembrete_texto = ${em ? texto?.slice(0, 200) || null : null}, updated_at = now()
    where conta_id = ${conta} and id = ${leadId}
  `;
  if (em) {
    const quando = em.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await registrarEvento(conta, leadId, 'lembrete', `Lembrete para ${quando}${texto ? `: ${texto.slice(0, 200)}` : ''}`, quem);
  } else if (antes.lembrete_em) {
    await registrarEvento(conta, leadId, 'lembrete_feito', 'Lembrete concluído', quem);
  }
  return true;
}

/** fim do dia de hoje no horário de Brasília */
function fimDeHoje(): Date {
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 23 + 3, 59, 59));
}

/** os lembretes que vencem hoje ou já passaram, mais cedo primeiro */
export async function lembretesParaHoje(conta: string, limite = 50): Promise<Lembrete[]> {
  const linhas = await db()`
    select id, name, category, lembrete_em, lembrete_texto from leads
    where conta_id = ${conta} and lembrete_em is not null and lembrete_em <= ${fimDeHoje()}
    order by lembrete_em
    limit ${limite}
  `;
  const agora = Date.now();
  return linhas.map((r) => ({
    leadId: r.id as string,
    nome: r.name as string,
    categoria: r.category as string | null,
    em: new Date(r.lembrete_em).toISOString(),
    texto: r.lembrete_texto as string | null,
    atrasado: new Date(r.lembrete_em).getTime() < agora,
  }));
}

export async function quantosLembretesHoje(conta: string): Promise<number> {
  const [r] = await db()`
    select count(*)::int as n from leads
    where conta_id = ${conta} and lembrete_em is not null and lembrete_em <= ${fimDeHoje()}
  `;
  return (r?.n as number) || 0;
}
