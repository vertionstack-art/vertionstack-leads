import { NextResponse } from 'next/server';
import { normalizarLead, salvarLeads } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { cotaDaConta } from '@/lib/conta';
import { estourou } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Importar leads de uma planilha (CSV). Quem chama é a página /importar, em
 * lotes de até 500 linhas já separadas em colunas.
 *
 * A planilha é da própria pessoa e não custa busca no Google, então NÃO gasta
 * a cota semanal de leads; respeita só o teto de leads guardados do plano.
 * Comércio que já existe na lista é atualizado (só preenche o que faltava).
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome, plano } = s.sessao;
  if (await estourou('importar:' + contaId, 40, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Importações demais em pouco tempo. Espere alguns minutos.' }, { status: 429 });
  }

  const corpo = (await req.json().catch(() => null)) as { linhas?: unknown } | null;
  const linhas = corpo?.linhas;
  if (!Array.isArray(linhas)) return NextResponse.json({ ok: false, erro: 'Nada para importar.' }, { status: 400 });
  if (linhas.length > 500) return NextResponse.json({ ok: false, erro: 'Lote grande demais (máximo 500 por vez).' }, { status: 413 });

  const limpos = linhas
    .map((b) => {
      const l = (b || {}) as Record<string, unknown>;
      const nomeDoComercio = String(l.name || '').trim().toLowerCase();
      const ref = String(l.phone || l.address || l.city || '').replace(/\D/g, '') || String(l.city || '').trim().toLowerCase();
      return normalizarLead({ ...l, placeKey: `planilha:${nomeDoComercio}|${ref}`, searchTerm: 'planilha' }, nome, 'planilha');
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  // o mesmo comércio repetido no arquivo: junta as linhas, a primeira que tiver o dado vale
  const porId = new Map<string, (typeof limpos)[number]>();
  for (const l of limpos) {
    const antes = porId.get(l.id);
    if (!antes) porId.set(l.id, l);
    else {
      const junto = { ...antes } as Record<string, unknown>;
      for (const [k, v] of Object.entries(l)) if ((junto[k] === null || junto[k] === undefined) && v !== null) junto[k] = v;
      porId.set(l.id, junto as unknown as (typeof limpos)[number]);
    }
  }
  const unicos = Array.from(porId.values());

  const cota = await cotaDaConta(contaId, plano);
  const vagas = cota.ilimitado ? undefined : Math.max(0, cota.tetoGuardados - cota.guardados);
  try {
    const r = await salvarLeads(contaId, unicos, vagas);
    return NextResponse.json({
      ok: true,
      novos: r.novos,
      atualizados: r.atualizados,
      semNome: linhas.length - limpos.length,
      repetidosNoArquivo: limpos.length - unicos.length,
      barradosPeloLimite: r.barradosPelaCota,
      teto: cota.tetoGuardados,
    });
  } catch (e) {
    console.error('[importar]', e);
    return NextResponse.json({ ok: false, erro: 'Falha ao gravar. Tente de novo.' }, { status: 500 });
  }
}
