/**
 * Conexão única com o Postgres do Supabase.
 *
 * Usa o usuário de banco `app_vertion`, que só o servidor conhece. O
 * navegador nunca fala com o banco: as tabelas têm RLS ligado sem nenhuma
 * política, então a chave pública do Supabase não lê nada. Quem garante que
 * cada pessoa só veja a própria conta é este servidor, filtrando toda
 * consulta pelo conta_id da sessão.
 *
 * `prepare: false` porque a conexão passa pelo pooler do Supabase em modo
 * transação, que não guarda comandos preparados entre uma chamada e outra.
 */

import postgres from 'postgres';

const URL_BANCO = process.env.SUPABASE_DB_URL || '';

export const temBanco = Boolean(URL_BANCO);

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __vlSql?: Sql };

function criar(): Sql {
  return postgres(URL_BANCO, { prepare: false, ssl: 'require', max: 5, idle_timeout: 20, connect_timeout: 15 });
}

/** lança um erro claro em vez de um "cannot read property of null" perdido */
export function db(): Sql {
  if (!URL_BANCO) throw new Error('Banco não configurado: falta a variável SUPABASE_DB_URL.');
  if (!g.__vlSql) g.__vlSql = criar();
  return g.__vlSql;
}

/** jsonb volta como texto quando o tipo não é descrito; isto devolve o objeto */
export function json<T = unknown>(v: unknown): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}
