import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { daLinha } from '@/lib/db';
import { db } from '@/lib/sql';
import { temperaturaDoLead } from '@/lib/temperatura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** os leads que têm localização, só com o que o mapa precisa */
export async function GET() {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const linhas = await db()`
    select * from leads
    where conta_id = ${s.sessao.contaId} and lat is not null and lng is not null and is_lead
    order by updated_at desc
    limit 2000
  `;
  const pontos = linhas.map((r) => {
    const l = daLinha(r);
    return {
      id: l.id,
      nome: l.name,
      categoria: l.category,
      endereco: l.address,
      lat: l.lat,
      lng: l.lng,
      status: l.status,
      nivel: temperaturaDoLead(l).nivel,
      telefone: l.phone,
    };
  });
  return NextResponse.json({ ok: true, pontos });
}
