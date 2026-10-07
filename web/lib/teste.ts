/**
 * O teste grátis e a trava contra quem cria conta atrás de conta para usá-lo
 * de novo.
 *
 * Cada conta no Free deixa rastros: o navegador (um cookie que o proxy grava
 * no primeiro acesso), o computador (o id da instalação da extensão), a rede
 * (IP + navegador juntos) e o e-mail normalizado. Quando uma conta nova vai
 * puxar o primeiro lead, olhamos se algum rastro dela bate com o de outra
 * conta que já usou o teste. Se bate, o teste dela fica negado e a tela pede
 * para assinar.
 *
 * Nada disso é infalível: quem troca de navegador, de computador, de internet
 * e de e-mail ao mesmo tempo passa. Pega o caso comum, que é a mesma pessoa
 * criando várias contas do mesmo lugar. Os rastros guardam só hash, nunca o
 * IP ou o e-mail em texto.
 */

import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db } from './sql';

export type TipoSinal = 'navegador' | 'aparelho' | 'rede' | 'email';
export interface Sinal {
  tipo: TipoSinal;
  valor: string;
}

export const COOKIE_NAVEGADOR = 'vl_disp';

/** quanto tempo um IP compartilhado ainda conta como "o mesmo lugar" */
const DIAS_REDE = 7;

/** como a tela completa "o teste grátis já foi usado em outra conta ..." */
const MOTIVO: Record<TipoSinal, string> = {
  navegador: 'neste navegador',
  aparelho: 'neste computador',
  rede: 'nesta internet',
  email: 'com este e-mail',
};

function hash(tipo: TipoSinal, valor: string): string {
  const sal = process.env.TESTE_SAL || 'vertion-leads:teste';
  return createHash('sha256').update(`${sal}:${tipo}:${valor}`).digest('hex');
}

/** fulano.silva+teste@gmail.com e fulanosilva@gmail.com são a mesma caixa */
export function emailNormalizado(email: string): string {
  const [local, dominio = ''] = email.trim().toLowerCase().split('@');
  let l = local.split('+')[0];
  const d = dominio === 'googlemail.com' ? 'gmail.com' : dominio;
  if (d === 'gmail.com') l = l.replace(/\./g, '');
  return `${l}@${d}`;
}

function ipDe(h: Headers): string {
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
}

/** rastros de uma requisição: rede sempre que houver IP, aparelho quando a extensão manda */
export function sinaisDaRequisicao(h: Headers, extra: { aparelho?: string; email?: string; navegador?: string } = {}): Sinal[] {
  const s: Sinal[] = [];
  const ip = ipDe(h);
  const ua = (h.get('user-agent') || '').slice(0, 300);
  if (ip) s.push({ tipo: 'rede', valor: `${ip}|${ua}` });
  if (extra.aparelho) s.push({ tipo: 'aparelho', valor: extra.aparelho });
  if (extra.navegador) s.push({ tipo: 'navegador', valor: extra.navegador });
  if (extra.email) s.push({ tipo: 'email', valor: emailNormalizado(extra.email) });
  return s;
}

/** os rastros de quem abriu uma página logado no Free */
export async function sinaisDaPagina(email: string): Promise<Sinal[]> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return sinaisDaRequisicao(h, { email, navegador: c.get(COOKIE_NAVEGADOR)?.value });
}

export async function registrarSinais(conta: string, sinais: Sinal[]): Promise<void> {
  if (!sinais.length) return;
  const sql = db();
  const linhas = sinais.map((s) => ({ conta_id: conta, tipo: s.tipo, valor: hash(s.tipo, s.valor) }));
  await sql`
    insert into sinais_teste ${sql(linhas, 'conta_id', 'tipo', 'valor')}
    on conflict (tipo, valor, conta_id) do update set visto_em = now()
  `;
  // quem já usou o teste marca o rastro novo também
  await sql`
    update sinais_teste s set usou_teste = true
    from contas c
    where s.conta_id = ${conta} and c.id = s.conta_id and c.teste_usados > 0 and not s.usou_teste
  `;
}

/**
 * Algum rastro desta conta bate com o de outra conta (ou de uma conta já
 * apagada) que usou o teste? Devolve o tipo de rastro, para a tela explicar.
 * Para a rede vale só o que foi visto nos últimos dias: IP de operadora muda
 * de dono o tempo todo.
 */
export async function testeJaUsadoPorOutra(conta: string): Promise<string | null> {
  const r = await db()`
    select s2.tipo from sinais_teste s1
    join sinais_teste s2 on s2.tipo = s1.tipo and s2.valor = s1.valor and s2.conta_id is distinct from s1.conta_id
    where s1.conta_id = ${conta} and s2.usou_teste
      and (s1.tipo <> 'rede' or s2.visto_em > now() - make_interval(days => ${DIAS_REDE}))
    order by case s2.tipo when 'aparelho' then 0 when 'navegador' then 1 when 'email' then 2 else 3 end
    limit 1
  `;
  return r.length ? MOTIVO[r[0].tipo as TipoSinal] : null;
}

export async function marcarTesteUsado(conta: string): Promise<void> {
  await db()`update sinais_teste set usou_teste = true where conta_id = ${conta} and not usou_teste`;
}
