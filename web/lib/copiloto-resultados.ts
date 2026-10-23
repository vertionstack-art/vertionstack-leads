/**
 * Os números do copiloto comercial para a tela do treino: das mensagens
 * enviadas nos últimos 90 dias, de onde cada uma saiu (tarefa do copiloto,
 * robô ou escrita à mão) e quantas tiveram resposta do cliente em até 7
 * dias; e quanto a IA trabalhou nos últimos 30 dias (pedidos, tempo).
 *
 * É correlação, não prova: amostra pequena engana, e a resposta pode ter
 * vindo pelo assunto, pelo dia ou pelo lead, não pelo texto. A tela avisa.
 * Só roda no servidor.
 */

import { db } from './sql';

export interface LinhaResultado {
  origem: string;
  enviadas: number;
  respondidas: number;
}

export interface LinhaUso {
  tarefa: string;
  pedidos: number;
  /** tempo médio em segundos; null quando ainda não era medido */
  segundos: number | null;
}

export async function resultadosDoCopiloto(conta: string): Promise<{ envios: LinhaResultado[]; uso: LinhaUso[] }> {
  const envios = await db()`
    with enviadas as (
      select id, lead_id, criado_em, case when robo then 'robo' else coalesce(origem_ia, 'manual') end as origem
      from conversa_mensagens
      where conta_id = ${conta} and autor = 'eu' and criado_em > now() - interval '90 days'
    )
    select origem, count(*)::int as enviadas,
      count(*) filter (where exists (
        select 1 from conversa_mensagens c
        where c.conta_id = ${conta} and c.lead_id = e.lead_id and c.autor = 'cliente'
          and c.criado_em > e.criado_em and c.criado_em < e.criado_em + interval '7 days'
      ))::int as respondidas
    from enviadas e
    group by origem
    order by enviadas desc
  `;
  const uso = await db()`
    select coalesce(tarefa, 'sem registro') as tarefa, count(*)::int as pedidos, round(avg(ms) / 1000.0, 1)::float as segundos
    from uso_ia
    where conta_id = ${conta} and modelo not like 'claude%' and criado_em > now() - interval '30 days'
    group by 1
    order by pedidos desc
  `;
  return {
    envios: envios.map((r) => ({ origem: r.origem as string, enviadas: r.enviadas as number, respondidas: r.respondidas as number })),
    uso: uso.map((r) => ({ tarefa: r.tarefa as string, pedidos: r.pedidos as number, segundos: r.segundos === null ? null : Number(r.segundos) })),
  };
}
