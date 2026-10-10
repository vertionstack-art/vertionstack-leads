/**
 * Modelos de mensagem: o jeito de abordar de cada pessoa, salvo para usar
 * em qualquer lead. Os marcadores ({comercio}, {cidade}...) são trocados na
 * ficha, no navegador (lib/mensagem, aplicarModelo).
 */

import { db } from './sql';

export const MAX_MODELOS = 20;

export interface Modelo {
  id: string;
  nome: string;
  texto: string;
}

export async function listarModelos(conta: string): Promise<Modelo[]> {
  const r = await db()`select id, nome, texto from modelos_mensagem where conta_id = ${conta} order by criado_em`;
  return r.map((x) => ({ id: x.id as string, nome: x.nome as string, texto: x.texto as string }));
}

export async function criarModelo(conta: string, nome: string, texto: string): Promise<Modelo | 'cheio'> {
  const sql = db();
  const [n] = await sql`select count(*)::int as n from modelos_mensagem where conta_id = ${conta}`;
  if ((n?.n as number) >= MAX_MODELOS) return 'cheio';
  const [m] = await sql`
    insert into modelos_mensagem (conta_id, nome, texto) values (${conta}, ${nome}, ${texto})
    returning id, nome, texto
  `;
  return { id: m.id as string, nome: m.nome as string, texto: m.texto as string };
}

export async function apagarModelo(conta: string, id: string): Promise<boolean> {
  const r = await db()`delete from modelos_mensagem where conta_id = ${conta} and id = ${id} returning id`;
  return r.length > 0;
}
