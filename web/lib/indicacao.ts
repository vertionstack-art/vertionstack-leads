/**
 * Indique e ganhe: cada conta tem um link de convite. Quem cria conta por
 * ele fica anotado como indicado; quando o indicado PAGA um plano (qualquer
 * um, inclusive o de 7 dias), quem indicou ganha leads e buscas de bônus.
 * Indicado que só faz o teste grátis não rende nada (decisão do Lucas,
 * 10/10/2026): o bônus custa busca no Google, e só sai quando entra dinheiro.
 *
 * Contra abuso: indicado e indicador que dividem navegador, computador,
 * internet ou e-mail (os mesmos rastros do teste grátis, lib/teste) não
 * creditam — é a mesma pessoa indicando a si mesma.
 *
 * O bônus é um saldo que não vence e é gasto só depois da cota do plano
 * acabar (lib/conta, reservarCota; app/api/busca).
 */

import { randomBytes } from 'crypto';
import { db } from './sql';

export const BONUS_LEADS = 50;
export const BONUS_BUSCAS = 5;

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const FORMATO_CODIGO = /^[a-z0-9]{6,12}$/;

function novoCodigo(): string {
  const b = randomBytes(8);
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join('');
}

/** o código de convite da conta, criado na primeira vez que alguém pede */
export async function codigoDaConta(conta: string): Promise<string> {
  const sql = db();
  const [c] = await sql`select codigo_convite from contas where id = ${conta}`;
  if (c?.codigo_convite) return c.codigo_convite as string;
  for (let i = 0; i < 5; i++) {
    try {
      const [r] = await sql`
        update contas set codigo_convite = coalesce(codigo_convite, ${novoCodigo()})
        where id = ${conta} returning codigo_convite
      `;
      return r.codigo_convite as string;
    } catch {
      // colisão de código (raríssima): tenta outro
    }
  }
  throw new Error('Não consegui gerar o código de convite.');
}

/** conta nova chegou por um convite: anota quem indicou (uma vez só, nunca a si mesma) */
export async function registrarIndicacao(contaIndicada: string, codigo: string): Promise<void> {
  const limpo = codigo.trim().toLowerCase();
  if (!FORMATO_CODIGO.test(limpo)) return;
  const sql = db();
  const [ind] = await sql`select id from contas where codigo_convite = ${limpo}`;
  if (!ind || ind.id === contaIndicada) return;
  await sql`
    insert into indicacoes (conta_indicada, conta_indicadora) values (${contaIndicada}, ${ind.id})
    on conflict (conta_indicada) do nothing
  `;
}

/**
 * O indicado pagou: credita o bônus de quem indicou, uma vez. Chamado a cada
 * pagamento confirmado; só a primeira chamada acha a indicação "aguardando".
 */
export async function creditarIndicacao(contaIndicada: string): Promise<void> {
  try {
    const sql = db();
    const [ind] = await sql`select conta_indicadora from indicacoes where conta_indicada = ${contaIndicada} and situacao = 'aguardando'`;
    if (!ind) return;
    const [mesmo] = await sql`
      select s1.tipo from sinais_teste s1
      join sinais_teste s2 on s2.tipo = s1.tipo and s2.valor = s1.valor
      where s1.conta_id = ${contaIndicada} and s2.conta_id = ${ind.conta_indicadora}
      limit 1
    `;
    if (mesmo) {
      await sql`
        update indicacoes set situacao = 'recusada', pago_em = now(), motivo = ${'mesmo ' + mesmo.tipo}
        where conta_indicada = ${contaIndicada} and situacao = 'aguardando'
      `;
      return;
    }
    await sql.begin(async (tx) => {
      const r = await tx`
        update indicacoes set situacao = 'creditada', pago_em = now()
        where conta_indicada = ${contaIndicada} and situacao = 'aguardando'
        returning conta_indicadora
      `;
      if (!r.length) return;
      await tx`
        update contas set leads_bonus = leads_bonus + ${BONUS_LEADS}, buscas_bonus = buscas_bonus + ${BONUS_BUSCAS}
        where id = ${r[0].conta_indicadora}
      `;
    });
  } catch (e) {
    // o pagamento já foi liberado; o bônus pode ser conferido depois pela central
    console.error('[indicacao]', e);
  }
}

export interface MinhaIndicacao {
  nome: string;
  criadaEm: string;
  situacao: 'aguardando' | 'creditada' | 'recusada';
}

export interface ResumoIndicacao {
  codigo: string;
  leadsBonus: number;
  buscasBonus: number;
  indicacoes: MinhaIndicacao[];
}

export async function resumoDaIndicacao(conta: string): Promise<ResumoIndicacao> {
  const codigo = await codigoDaConta(conta);
  const sql = db();
  const [c] = await sql`select leads_bonus, buscas_bonus from contas where id = ${conta}`;
  const linhas = await sql`
    select c.nome, i.criada_em, i.situacao from indicacoes i join contas c on c.id = i.conta_indicada
    where i.conta_indicadora = ${conta} order by i.criada_em desc limit 100
  `;
  return {
    codigo,
    leadsBonus: (c?.leads_bonus as number) || 0,
    buscasBonus: (c?.buscas_bonus as number) || 0,
    indicacoes: linhas.map((r) => ({
      nome: String(r.nome || 'alguém'),
      criadaEm: new Date(r.criada_em).toISOString(),
      situacao: r.situacao as MinhaIndicacao['situacao'],
    })),
  };
}

/** gasta até `quantos` leads do bônus; devolve quantos conseguiu */
export async function tirarDoBonus(conta: string, quantos: number): Promise<number> {
  if (quantos <= 0) return 0;
  const r = await db()`
    with antes as (select leads_bonus from contas where id = ${conta} for update)
    update contas c set leads_bonus = c.leads_bonus - least(c.leads_bonus, ${quantos})
      from antes where c.id = ${conta}
    returning antes.leads_bonus - c.leads_bonus as gastos
  `;
  return r.length ? Math.max(0, Number(r[0].gastos)) : 0;
}

/** gasta uma busca do bônus, se houver */
export async function usarBuscaBonus(conta: string): Promise<boolean> {
  const r = await db()`update contas set buscas_bonus = buscas_bonus - 1 where id = ${conta} and buscas_bonus > 0 returning id`;
  return r.length > 0;
}
