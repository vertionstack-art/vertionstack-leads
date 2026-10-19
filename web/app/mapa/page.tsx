import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import MapaDosLeads from './mapa';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { Map as IconeMapaCasca } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaMapa() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  return (
    <Casca
      tela="mapa"
      conversas={podeUsarConversa(sessao.email)}
      cor="menta"
      icone={<IconeMapaCasca aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Mapa dos leads</>}
      subtitulo={<>Onde estão os seus comércios. Bom para montar uma rota de visitas no mesmo bairro.</>}
    >
        <MapaDosLeads />
    </Casca>
  );
}
