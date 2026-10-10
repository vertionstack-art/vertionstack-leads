/**
 * A central de administração: todas as pessoas que criaram conta, em que pé
 * cada uma está (teste, assinante, vencido, desistiu da compra) e as ações
 * sobre elas. Só o administrador chega aqui — a rota confere ADMIN_EMAILS e o
 * segundo fator antes de chamar qualquer coisa deste arquivo.
 */

import { db } from './sql';
import { planoEfetivo, type Plano } from './conta';
import { LIMITES } from './planos';

/**
 * Em que pé a pessoa está:
 *  - assinante: plano pago em dia;
 *  - vencido: já pagou alguma vez e o plano venceu sem renovar;
 *  - teste / teste_esgotado / teste_negado: nunca pagou;
 *  - cortesia e bloqueado, à parte.
 */
export type Situacao = 'assinante' | 'vencido' | 'teste' | 'teste_esgotado' | 'teste_negado' | 'cortesia' | 'bloqueado';

export interface Pessoa {
  userId: string;
  email: string;
  nome: string | null;
  contaId: string | null;
  contaNome: string | null;
  papel: string | null;
  planoGuardado: string | null;
  plano: Plano;
  situacao: Situacao;
  pagoAte: string | null;
  forma: string | null;
  cancelaEm: string | null;
  cartaoRecusado: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  emailConfirmado: boolean;
  leads: number;
  testeUsados: number;
  testeNegado: string | null;
  buscasMes: number;
  buscasTotal: number;
  totalPagoCentavos: number;
  pagamentos: number;
  ultimoPagamento: string | null;
  /** páginas de pagamento abertas há mais de 1 hora sem compra depois */
  comprasAbandonadas: number;
  ultimaTentativa: { plano: string; forma: string; em: string; pago: boolean } | null;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function pessoas(): Promise<Pessoa[]> {
  const r = await db()`
    with u as (select * from public.usuarios_para_central())
    select u.id as user_id, u.email, u.criado_em, u.ultimo_acesso, u.email_confirmado_em,
      m.nome, m.papel, c.id as conta_id, c.nome as conta_nome, c.plano, c.pago_ate, c.bloqueada,
      c.forma_pagamento, c.assinatura_cancela_em, c.pagamento_falhou, c.teste_usados, c.teste_negado,
      (select count(*)::int from leads l where l.conta_id = c.id) as leads,
      (select coalesce(sum(b.chamadas), 0)::int from busca_google b where b.conta_id = c.id
         and date_trunc('month', b.dia) = date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)) as buscas_mes,
      (select coalesce(sum(b.chamadas), 0)::int from busca_google b where b.conta_id = c.id) as buscas_total,
      (select coalesce(sum(p.valor_centavos), 0)::int from pagamentos p where p.conta_id = c.id) as total_pago,
      (select count(*)::int from pagamentos p where p.conta_id = c.id) as n_pagamentos,
      (select max(p.pago_em) from pagamentos p where p.conta_id = c.id) as ultimo_pagamento,
      (select count(*)::int from checkouts k where k.conta_id = c.id and k.pago_em is null
         and k.criado_em < now() - interval '1 hour'
         and not exists (select 1 from pagamentos p where p.conta_id = c.id and p.pago_em > k.criado_em)) as abandonadas,
      (select json_build_object('plano', k.plano, 'forma', k.forma, 'em', k.criado_em, 'pago', k.pago_em is not null)
         from checkouts k where k.conta_id = c.id order by k.criado_em desc limit 1) as ultima_tentativa
    from u
    left join membros m on m.user_id = u.id
    left join contas c on c.id = m.conta_id
    order by u.criado_em desc
    limit 3000
  `;
  return r.map((x) => {
    const ef = planoEfetivo(x.plano || 'gratis', x.pago_ate);
    const pagou = (x.n_pagamentos as number) > 0;
    const pagoVencido = ['semanal', 'basic', 'pro', 'pago'].includes(x.plano) && ef.plano === 'gratis';
    const situacao: Situacao = x.bloqueada
      ? 'bloqueado'
      : ef.plano === 'cortesia'
        ? 'cortesia'
        : ef.plano !== 'gratis'
          ? 'assinante'
          : pagou || pagoVencido
            ? 'vencido'
            : x.teste_negado
              ? 'teste_negado'
              : (x.teste_usados ?? 0) >= LIMITES.gratis.semana || (x.buscas_total ?? 0) >= LIMITES.gratis.buscas
                ? 'teste_esgotado'
                : 'teste';
    const t = typeof x.ultima_tentativa === 'string' ? JSON.parse(x.ultima_tentativa) : x.ultima_tentativa;
    return {
      userId: x.user_id,
      email: x.email,
      nome: x.nome,
      contaId: x.conta_id,
      contaNome: x.conta_nome,
      papel: x.papel,
      planoGuardado: x.plano,
      plano: ef.plano,
      situacao,
      pagoAte: iso(x.pago_ate),
      forma: x.forma_pagamento,
      cancelaEm: iso(x.assinatura_cancela_em),
      cartaoRecusado: Boolean(x.pagamento_falhou),
      criadoEm: iso(x.criado_em)!,
      ultimoAcesso: iso(x.ultimo_acesso),
      emailConfirmado: Boolean(x.email_confirmado_em),
      leads: x.leads ?? 0,
      testeUsados: x.teste_usados ?? 0,
      testeNegado: x.teste_negado,
      buscasMes: x.buscas_mes ?? 0,
      buscasTotal: x.buscas_total ?? 0,
      totalPagoCentavos: x.total_pago ?? 0,
      pagamentos: x.n_pagamentos ?? 0,
      ultimoPagamento: iso(x.ultimo_pagamento),
      comprasAbandonadas: x.abandonadas ?? 0,
      ultimaTentativa: t ? { plano: t.plano, forma: t.forma, em: new Date(t.em).toISOString(), pago: Boolean(t.pago) } : null,
    };
  });
}

export interface PagamentoCentral {
  id: string;
  email: string | null;
  plano: string;
  forma: string;
  valorCentavos: number;
  descricao: string | null;
  pagoEm: string;
}

export async function pagamentos(limite = 300): Promise<PagamentoCentral[]> {
  const r = await db()`
    select p.id, p.plano, p.forma, p.valor_centavos, p.descricao, p.pago_em,
      (select public.email_do_usuario(m.user_id) from membros m where m.conta_id = p.conta_id and m.papel = 'dono' limit 1) as email
    from pagamentos p
    order by p.pago_em desc
    limit ${limite}
  `;
  return r.map((x) => ({
    id: x.id,
    email: x.email,
    plano: x.plano,
    forma: x.forma,
    valorCentavos: x.valor_centavos,
    descricao: x.descricao,
    pagoEm: new Date(x.pago_em).toISOString(),
  }));
}

/** cadastros, compras e buscas por dia nos últimos 30 dias, para os gráficos */
export async function porDia(): Promise<{ dia: string; cadastros: number; compras: number; buscas: number }[]> {
  const r = await db()`
    with dias as (
      select generate_series(((now() at time zone 'America/Sao_Paulo')::date - 29), (now() at time zone 'America/Sao_Paulo')::date, '1 day')::date as dia
    )
    select d.dia::text as dia,
      (select count(*)::int from public.usuarios_para_central() u where (u.criado_em at time zone 'America/Sao_Paulo')::date = d.dia) as cadastros,
      (select count(*)::int from pagamentos p where (p.pago_em at time zone 'America/Sao_Paulo')::date = d.dia) as compras,
      (select coalesce(sum(b.chamadas), 0)::int from busca_google b where b.dia = d.dia) as buscas
    from dias d order by d.dia
  `;
  return r.map((x) => ({ dia: x.dia, cadastros: x.cadastros, compras: x.compras, buscas: x.buscas }));
}

// ------------------------------------------------------------ ações

/** soma dias ao plano pago que a conta já tem (ou a partir de hoje) */
export async function darDias(contaId: string, dias: number): Promise<void> {
  await db()`
    update contas set pago_ate = greatest(coalesce(pago_ate, now()), now()) + make_interval(days => ${dias})
    where id = ${contaId} and plano <> 'cortesia'
  `;
}

/** tira a trava de "teste já usado em outro computador" — para quem foi barrado por engano */
export async function liberarTeste(contaId: string): Promise<void> {
  await db()`update contas set teste_negado = null where id = ${contaId}`;
}

/**
 * Apaga uma pessoa de vez: a assinatura é cancelada na Stripe antes (se não
 * der, nada é apagado — ela não pode continuar sendo cobrada sem conta), e
 * quem é dono da conta leva junto a conta inteira (leads, CRM, propostas).
 * Os rastros do teste grátis ficam, sem dono: criar outra conta no mesmo
 * computador ou e-mail não devolve o teste.
 */
export async function apagarPessoa(userId: string): Promise<{ apagouConta: boolean; leads: number }> {
  const { cancelarAssinaturaJa } = await import('./pagamento');
  const sql = db();
  const [m] = await sql`select conta_id, papel from membros where user_id = ${userId}`;
  let apagouConta = false;
  let leads = 0;
  if (m) {
    if (m.papel === 'dono') {
      await cancelarAssinaturaJa(m.conta_id);
      const [n] = await sql`select count(*)::int as n from leads where conta_id = ${m.conta_id}`;
      leads = n.n as number;
      // quem mais estivesse na conta fica sem ela e ganha uma conta nova, vazia, ao entrar de novo
      await sql`delete from contas where id = ${m.conta_id}`;
      apagouConta = true;
    } else {
      await sql`delete from membros where user_id = ${userId}`;
    }
  }
  await sql`select public.apagar_usuario(${userId})`;
  return { apagouConta, leads };
}
