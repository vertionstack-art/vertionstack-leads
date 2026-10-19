import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { quadro } from '@/lib/crm';
import { LIMITES } from '@/lib/planos';
import QuadroCrm from './quadro';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { Kanban } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaCrm({ searchParams }: { searchParams: Promise<{ funil?: string }> }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const { funil } = await searchParams;
  const inicial = await quadro(sessao.contaId, funil || null);

  return (
    <Casca
      tela="crm"
      conversas={podeUsarConversa(sessao.email)}
      cor="lavanda"
      icone={<Kanban aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>CRM</>}
      subtitulo={<>Arraste os cards entre as etapas. A situação do lead no painel e no Financeiro muda junto.</>}
    >
        <QuadroCrm inicial={inicial} tetoFunis={LIMITES[sessao.plano].funis} />
    </Casca>
  );
}
