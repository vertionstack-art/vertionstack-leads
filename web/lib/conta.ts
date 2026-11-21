/**
 * Quem está usando a ferramenta e de que conta.
 *
 * Desde 21/11/2026 a ferramenta é só do Lucas: não há mais planos, cotas,
 * teste grátis, cadastro nem pagamento. Só entra quem já tem conta (a dele);
 * login novo que não tenha conta não ganha uma, cai fora.
 *
 * A conta nunca vem do navegador: o que chega é só "quem eu sou" (cookie do
 * login), e a conta sai do banco a partir disso.
 */

import { db } from './sql';
import { supabaseServidor } from './supabase-server';

export interface Sessao {
  userId: string;
  email: string;
  /** como a pessoa aparece no painel (responsável, coletado por) */
  nome: string;
  /** "o" ou "a" antes do nome nas mensagens ("Aqui é o Lucas"); vazio = sem artigo */
  artigo: string;
  contaId: string;
  contaNome: string;
  papel: 'dono' | 'membro';
  bloqueada: boolean;
}

export async function sessaoAtual(): Promise<Sessao | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await supabaseServidor();
  // getUser confere o token com o servidor de login; getSession só leria o cookie
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email) return null;

  const linhas = await db()`
    select m.conta_id, m.nome, m.artigo, m.papel, c.nome as conta_nome, c.bloqueada
    from membros m join contas c on c.id = m.conta_id
    where m.user_id = ${user.id}
  `;
  if (!linhas.length) return null;
  const r = linhas[0];
  return {
    userId: user.id,
    email: user.email,
    nome: r.nome,
    artigo: r.artigo || '',
    contaId: r.conta_id,
    contaNome: r.conta_nome,
    papel: r.papel,
    bloqueada: r.bloqueada,
  };
}

/** os nomes de quem divide a conta, para o filtro "de quem" do painel */
export async function equipeDaConta(conta: string): Promise<string[]> {
  const r = await db()`select nome from membros where conta_id = ${conta} order by nome`;
  return r.map((x) => x.nome as string);
}

/** a conta que recebeu os leads de antes das contas existirem (links antigos de proposta) */
export async function contaLegada(): Promise<string | null> {
  const r = await db()`select id from contas where legado = true limit 1`;
  return r.length ? (r[0].id as string) : null;
}
