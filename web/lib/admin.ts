/**
 * O que só quem administra a ferramenta faz: mudar plano, suspender conta,
 * juntar alguém numa conta e ver a receita da ferramenta.
 *
 * Toda rota que chama isto confere antes `sessao.admin`, que vem da
 * variável ADMIN_EMAILS — não de algo gravado no banco.
 */

import { db } from './sql';
import type { Plano } from './conta';

export async function mudarConta(contaId: string, mudanca: { plano?: Plano; bloqueada?: boolean }): Promise<void> {
  const sql = db();
  if (mudanca.plano === 'semanal') {
    await sql`update contas set plano = 'semanal', pago_ate = greatest(coalesce(pago_ate, now()), now()) + interval '7 days' where id = ${contaId}`;
  } else if (mudanca.plano === 'basic' || mudanca.plano === 'pro') {
    // marcado à mão (pagamento por fora): vale 31 dias a partir de hoje, até a cobrança automática existir
    await sql`update contas set plano = ${mudanca.plano}, pago_ate = greatest(coalesce(pago_ate, now()), now()) + interval '31 days' where id = ${contaId}`;
  } else if (mudanca.plano) {
    await sql`update contas set plano = ${mudanca.plano} where id = ${contaId}`;
  }
  if (mudanca.bloqueada !== undefined) await sql`update contas set bloqueada = ${mudanca.bloqueada} where id = ${contaId}`;
}

/**
 * Põe uma pessoa já cadastrada dentro da conta do admin (como o João na
 * sua). Só junta quem ainda não tem leads na conta própria, para ninguém
 * perder trabalho sem querer; a conta vazia dela é apagada.
 */
export async function juntarNaConta(contaDestino: string, email: string): Promise<{ ok: boolean; erro?: string }> {
  const sql = db();
  const u = await sql`select public.usuario_pelo_email(${email.trim()}) as id`;
  if (!u[0]?.id) return { ok: false, erro: 'Ninguém com esse e-mail criou conta ainda. Peça para a pessoa se cadastrar primeiro.' };
  const userId = u[0].id as string;

  const atual = await sql`select conta_id from membros where user_id = ${userId}`;
  if (atual.length && atual[0].conta_id === contaDestino) return { ok: true };
  if (atual.length) {
    const n = await sql`select count(*)::int as n from leads where conta_id = ${atual[0].conta_id}`;
    if (n[0].n > 0) return { ok: false, erro: 'Essa pessoa já tem leads na conta dela. Junte manualmente para não perder nada.' };
  }

  const nome = (email.split('@')[0] || 'membro').toLowerCase().slice(0, 40);
  await sql.begin(async (tx) => {
    if (atual.length) {
      const antiga = atual[0].conta_id as string;
      await tx`delete from membros where user_id = ${userId}`;
      // a conta vazia que ela tinha some junto (só se não sobrou ninguém nela)
      await tx`delete from contas c where c.id = ${antiga} and not exists (select 1 from membros m where m.conta_id = c.id)`;
    }
    await tx`insert into membros (conta_id, user_id, nome, papel) values (${contaDestino}, ${userId}, ${nome}, 'membro')`;
  });
  return { ok: true };
}

export interface ReceitaDaFerramenta {
  /** contas com plano pago em dia, por plano */
  ativos: { basic: number; pro: number };
  /** quanto as assinaturas em dia somam por mês, em centavos */
  mensalCentavos: number;
  /** recebido no mês corrente e no anterior (horário de Brasília), em centavos */
  mesCentavos: number;
  mesAnteriorCentavos: number;
  totalCentavos: number;
  cancelamentosAgendados: number;
  cartoesRecusados: number;
  ultimos: { id: string; conta: string; plano: string; forma: string; valorCentavos: number; pagoEm: string }[];
}

/** a receita da Vertion com as assinaturas — só o admin vê */
export async function receitaDaFerramenta(): Promise<ReceitaDaFerramenta> {
  const sql = db();
  const precos = { basic: 3790, pro: 6790 };
  // em sequência: muitas consultas juntas na mesma conexão do pooler podem ficar presas
  const ativos = await sql`
      select plano, count(*)::int as n from contas
      where plano in ('basic', 'pro', 'pago') and pago_ate > now() and not bloqueada
      group by plano
    `;
  const mes = await sql`select
        coalesce(sum(valor_centavos) filter (where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo')), 0)::int as mes,
        coalesce(sum(valor_centavos) filter (where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month'), 0)::int as anterior,
        coalesce(sum(valor_centavos), 0)::int as total
      from pagamentos
    `;
  const flags = await sql`select count(*) filter (where assinatura_cancela_em is not null)::int as cancelando,
             count(*) filter (where pagamento_falhou)::int as recusados
      from contas
    `;
  const ultimos = await sql`select p.id, coalesce(c.nome, '—') as conta, p.plano, p.forma, p.valor_centavos, p.pago_em
      from pagamentos p left join contas c on c.id = p.conta_id
      order by p.pago_em desc limit 12
    `;

  const a = { basic: 0, pro: 0 };
  for (const r of ativos) a[r.plano === 'basic' ? 'basic' : 'pro'] += r.n;
  return {
    ativos: a,
    mensalCentavos: a.basic * precos.basic + a.pro * precos.pro,
    mesCentavos: mes[0].mes,
    mesAnteriorCentavos: mes[0].anterior,
    totalCentavos: mes[0].total,
    cancelamentosAgendados: flags[0].cancelando,
    cartoesRecusados: flags[0].recusados,
    ultimos: ultimos.map((x) => ({
      id: x.id,
      conta: x.conta,
      plano: x.plano,
      forma: x.forma,
      valorCentavos: x.valor_centavos,
      pagoEm: new Date(x.pago_em).toISOString(),
    })),
  };
}
