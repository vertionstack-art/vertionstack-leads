import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { sessaoAtual } from '@/lib/conta';
import { daLinha } from '@/lib/db';
import { db } from '@/lib/sql';
import { caminhoDaProposta } from '@/lib/token-proposta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import Casca from '@/app/casca';
import ListaPropostas from './lista';

export const dynamic = 'force-dynamic';

const MAX = 400;

/**
 * Todas as propostas da conta num lugar só: as montadas para um lead e as
 * avulsas, feitas sem cadastrar cliente. Daqui dá para criar, abrir, copiar
 * o link e ver se o cliente já abriu ou aceitou.
 */
export default async function PaginaPropostas() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');

  const linhas = await db()`
    select * from leads
    where conta_id = ${sessao.contaId} and (proposta is not null or so_proposta)
    order by updated_at desc
    limit ${MAX}
  `;
  const propostas = linhas.map((r) => {
    const lead = daLinha(r);
    return { ...lead, linkProposta: caminhoDaProposta(sessao.contaId, lead.id) };
  });

  return (
    <Casca
      tela="propostas"
      conversas={podeUsarConversa(sessao.email)}
      cor="manteiga"
      icone={<FileText aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Propostas</>}
      subtitulo={<>As propostas dos seus leads e as avulsas, feitas sem cadastrar cliente</>}
    >
      <ListaPropostas inicial={propostas} />
    </Casca>
  );
}
