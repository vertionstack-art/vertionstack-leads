/**
 * Primeiros passos: o guia que aparece no topo do painel até a pessoa fazer
 * o caminho inteiro uma vez (buscar, preencher a empresa, chamar no
 * WhatsApp, montar proposta, marcar lembrete). Cada passo é conferido no
 * banco, não marcado à mão: o guia some sozinho quando o trabalho de verdade
 * aconteceu, ou quando a pessoa o esconde.
 */

import { db } from './sql';

export type IdPasso = 'busca' | 'empresa' | 'whatsapp' | 'proposta' | 'lembrete';

export interface Passo {
  id: IdPasso;
  feito: boolean;
}

export async function primeirosPassos(conta: string): Promise<Passo[] | null> {
  const [r] = await db()`
    select
      c.passos_ocultos as ocultos,
      exists (select 1 from leads where conta_id = c.id) as busca,
      (c.empresa_nome is not null and c.empresa_nome <> '') as empresa,
      exists (select 1 from lead_eventos where conta_id = c.id and tipo = 'whatsapp') as whatsapp,
      exists (select 1 from leads where conta_id = c.id and proposta is not null) as proposta,
      exists (select 1 from lead_eventos where conta_id = c.id and tipo = 'lembrete') as lembrete
    from contas c where c.id = ${conta}
  `;
  if (!r || r.ocultos) return null;
  const passos: Passo[] = (['busca', 'empresa', 'whatsapp', 'proposta', 'lembrete'] as IdPasso[]).map((id) => ({
    id,
    feito: Boolean(r[id]),
  }));
  return passos.every((p) => p.feito) ? null : passos;
}

export async function esconderPassos(conta: string): Promise<void> {
  await db()`update contas set passos_ocultos = true where id = ${conta}`;
}
