import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { buscarLead, normalizarLead, salvarLeads } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { db } from '@/lib/sql';
import { caminhoDaProposta } from '@/lib/token-proposta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const texto = (v: unknown, max: number) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Proposta avulsa: para quem já está conversando por fora e só precisa do
 * orçamento, sem virar lead. Por baixo é um registro de lead marcado
 * so_proposta, para o link público, o aceite online e o Financeiro
 * funcionarem iguais; não gasta a cota de leads e não aparece no painel,
 * no CRM nem nas conversas.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem } = s.sessao;
  if (await estourou(`proposta-avulsa:${contaId}`, 30, 60)) {
    return NextResponse.json({ ok: false, erro: 'Propostas demais em pouco tempo. Espere um minuto.' }, { status: 429 });
  }
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = texto(c.nome, 250);
  if (!nome) return NextResponse.json({ ok: false, erro: 'Escreva para quem é a proposta.' }, { status: 400 });
  const tipo = c.tipo === 'pessoa' ? 'pessoa' : 'comercio';

  const lead = normalizarLead(
    {
      // nunca colide com um lead de verdade: duas propostas para o mesmo nome são duas propostas
      placeKey: `proposta:${randomUUID()}`,
      name: nome,
      category: texto(c.categoria, 120),
      phone: texto(c.telefone, 40),
      city: texto(c.cidade, 120),
      searchTerm: 'proposta avulsa',
      tipo,
    },
    quem,
    'proposta',
  );
  if (!lead) return NextResponse.json({ ok: false, erro: 'Não consegui ler os dados.' }, { status: 400 });

  await salvarLeads(contaId, [lead], 1);
  await db()`
    update leads set so_proposta = true, tipo = ${tipo}, is_lead = false, updated_at = now()
    where conta_id = ${contaId} and id = ${lead.id}
  `;
  const salvo = await buscarLead(contaId, lead.id);
  if (!salvo) return NextResponse.json({ ok: false, erro: 'Não consegui criar a proposta.' }, { status: 500 });
  return NextResponse.json({ ok: true, lead: { ...salvo, linkProposta: caminhoDaProposta(contaId, salvo.id) } });
}
