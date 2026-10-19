import { redirect } from 'next/navigation';
import { cotaDaConta, cotaParaJson, sessaoAtual } from '@/lib/conta';
import { buscaLigada, buscasDaConta } from '@/lib/google-places';
import { LIMITES } from '@/lib/planos';
import BuscaGoogle from './busca';
import EscolhaOferta from './oferta';
import { db } from '@/lib/sql';
import type { Oferta } from '@/lib/ofertas';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { Radar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaBuscar() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const [cota, usadas] = await Promise.all([
    cotaDaConta(sessao.contaId, sessao.plano),
    buscasDaConta(sessao.contaId, sessao.plano, sessao.pagoAte),
  ]);
  const [c] = await db()`
    select oferta, oferta_texto, oferta_publico, empresa_nome,
      (oferta = 'sites' and cardinality(oferta_publico) = 0 and oferta_texto is null) as nova
    from contas where id = ${sessao.contaId}
  `;
  const periodo = sessao.plano === 'gratis' ? 'do teste' : sessao.plano === 'semanal' ? 'destes 7 dias' : 'do mês';

  return (
    <Casca
      tela="buscar"
      conversas={podeUsarConversa(sessao.email)}
      cor="ceu"
      icone={<Radar aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Buscar leads</>}
      subtitulo={<>Direto do Google. Só entram os comércios que combinam com o que você vende.</>}
    >
        <EscolhaOferta
          inicial={{
            oferta: ((c?.oferta as string) || 'sites') as Oferta,
            texto: (c?.oferta_texto as string) || '',
            publico: (c?.oferta_publico as string[]) || [],
            negocio: (c?.empresa_nome as string) || '',
            nova: Boolean(c?.nova),
          }}
        />
        <BuscaGoogle
          ligada={buscaLigada()}
          cotaInicial={cotaParaJson(cota)}
          buscasIniciais={{ usadas, limite: LIMITES[sessao.plano].buscas, periodo, ilimitado: sessao.plano === 'cortesia' }}
        />
    </Casca>
  );
}
