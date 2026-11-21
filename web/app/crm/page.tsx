import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { FUNIS_MAXIMO, quadro } from '@/lib/crm';
import QuadroCrm from './quadro';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { Kanban } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaCrm({ searchParams }: { searchParams: Promise<{ funil?: string; origem?: string }> }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const { funil, origem } = await searchParams;
  const inicial = await quadro(sessao.contaId, funil || null, origem === 'exterior' ? 'exterior' : 'brasil');

  return (
    <Casca
      tela="crm"
      conversas={podeUsarConversa(sessao.email)}
      cor="lavanda"
      icone={<Kanban aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>CRM</>}
      subtitulo={<>Arraste os cards entre as etapas. A situação do lead no painel e no Financeiro muda junto.</>}
    >
        <QuadroCrm inicial={inicial} tetoFunis={FUNIS_MAXIMO} />
    </Casca>
  );
}
