/**
 * A fila de abordagem: os leads que ainda não receberam nenhuma mensagem,
 * um atrás do outro, para você revisar e mandar com um clique cada.
 *
 * Não existe envio sozinho. O teto de primeiras mensagens por dia vale no
 * servidor (rota /enviar), não só na tela: protege o número de denúncia em
 * massa, que é o que derruba conta no WhatsApp.
 */

import { db } from './sql';
import { daLinha } from './db';
import { numeroWhatsapp } from './telefone';
import { temperaturaDoLead, type Nivel } from './temperatura';

export const LIMITE_PRIMEIRAS_POR_DIA = 40;

/** quantas conversas você abriu hoje (dia de Brasília): a primeira fala do lead foi sua e foi hoje */
export async function primeirasHoje(conta: string): Promise<number> {
  const [r] = await db()`
    select count(*)::int as n from (
      select distinct on (lead_id) lead_id, autor, criado_em
      from conversa_mensagens where conta_id = ${conta}
      order by lead_id, criado_em, id
    ) p
    where p.autor = 'eu'
      and (p.criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
  `;
  return r.n as number;
}

/** o lead ainda não tem nenhuma mensagem: a próxima é a primeira */
export async function semConversa(conta: string, lead: string): Promise<boolean> {
  const [r] = await db()`select exists(select 1 from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead}) as tem`;
  return !r.tem;
}

export interface ItemFila {
  id: string;
  nome: string;
  ramo: string | null;
  cidade: string | null;
  temperatura: Nivel;
  pontos: number;
  motivos: string[];
}

/** quem ainda não foi chamado e tem celular, o mais quente primeiro */
export async function leadsDaFila(conta: string, max = 300): Promise<ItemFila[]> {
  const linhas = await db()`
    select l.* from leads l
    where l.conta_id = ${conta} and l.status = 'novo' and not l.so_proposta
      and not exists (select 1 from conversa_mensagens m where m.conta_id = l.conta_id and m.lead_id = l.id)
    order by l.updated_at desc
    limit 1000
  `;
  return linhas
    .map((r) => daLinha(r))
    .filter((l) => Boolean(l.whatsapp || (l.telefoneTipo !== 'fixo' && numeroWhatsapp(l.phone))))
    .map((l) => {
      const t = temperaturaDoLead(l);
      return { id: l.id, nome: l.name, ramo: l.category, cidade: l.city, temperatura: t.nivel, pontos: t.pontos, motivos: t.motivos.slice(0, 3) };
    })
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, max);
}
