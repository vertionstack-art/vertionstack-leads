/**
 * Limite de tentativas por janela de tempo, guardado no banco.
 *
 * No banco e não na memória porque a Vercel roda cada requisição num
 * servidor que pode ser outro: um contador em memória zeraria a cada visita
 * e o limite não limitaria nada.
 *
 * Uso: `await estourou('login:ip:' + ip, 20, 15 * 60)` — verdadeiro quando
 * a chave já passou de 20 tentativas nos últimos 15 minutos (janela fixa).
 */

import { db } from './sql';

export async function estourou(chave: string, maximo: number, janelaSegundos: number): Promise<boolean> {
  const r = await db()`
    insert into limites (chave, janela, n)
    values (${chave.slice(0, 200)}, to_timestamp(floor(extract(epoch from now()) / ${janelaSegundos}) * ${janelaSegundos}), 1)
    on conflict (chave, janela) do update set n = limites.n + 1
    returning n
  `;
  // de vez em quando, limpa o que já venceu; ninguém espera por isso
  if (Math.random() < 0.02) {
    db()`delete from limites where janela < now() - interval '1 day'`.catch(() => {});
  }
  return (r[0].n as number) > maximo;
}
