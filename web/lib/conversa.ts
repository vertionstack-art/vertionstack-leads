/**
 * O registro da conversa guiada com cada lead: as mensagens dos dois lados
 * (a do cliente é colada à mão) e os passos do roteiro já cumpridos.
 */

import { db } from './sql';
import { passoPorId } from './roteiro';

export interface MensagemConversa {
  id: number;
  autor: 'eu' | 'cliente';
  texto: string;
  passo: string | null;
  em: string;
}

export const MAX_MENSAGENS = 300;

export async function mensagensDaConversa(conta: string, lead: string): Promise<MensagemConversa[]> {
  const r = await db()`
    select id, autor, texto, passo, criado_em from conversa_mensagens
    where conta_id = ${conta} and lead_id = ${lead}
    order by criado_em, id
    limit ${MAX_MENSAGENS}
  `;
  return r.map((x) => ({
    id: Number(x.id),
    autor: x.autor as 'eu' | 'cliente',
    texto: x.texto as string,
    passo: (x.passo as string) || null,
    em: new Date(x.criado_em).toISOString(),
  }));
}

export async function passosFeitos(conta: string, lead: string): Promise<string[]> {
  const r = await db()`select passo from conversa_passos where conta_id = ${conta} and lead_id = ${lead} order by feito_em`;
  return r.map((x) => x.passo as string);
}

export async function registrarMensagem(
  conta: string,
  lead: string,
  autor: 'eu' | 'cliente',
  texto: string,
  passo: string | null,
): Promise<MensagemConversa | 'cheio'> {
  const [n] = await db()`select count(*)::int as n from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead}`;
  if ((n.n as number) >= MAX_MENSAGENS) return 'cheio';
  const p = passoPorId(passo) ? passo : null;
  const [x] = await db()`
    insert into conversa_mensagens (conta_id, lead_id, autor, texto, passo)
    values (${conta}, ${lead}, ${autor}, ${texto}, ${p})
    returning id, criado_em
  `;
  if (p && autor === 'eu') await marcarPasso(conta, lead, p, true);
  return { id: Number(x.id), autor, texto, passo: p, em: new Date(x.criado_em).toISOString() };
}

export async function apagarMensagem(conta: string, lead: string, id: number): Promise<boolean> {
  const r = await db()`delete from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead} and id = ${id} returning id`;
  return r.length > 0;
}

export async function marcarPasso(conta: string, lead: string, passo: string, feito: boolean): Promise<void> {
  if (!passoPorId(passo)) return;
  if (feito) {
    await db()`
      insert into conversa_passos (conta_id, lead_id, passo) values (${conta}, ${lead}, ${passo})
      on conflict (conta_id, lead_id, passo) do nothing
    `;
  } else {
    await db()`delete from conversa_passos where conta_id = ${conta} and lead_id = ${lead} and passo = ${passo}`;
  }
}
