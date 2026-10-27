import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ListOrdered } from 'lucide-react';
import { sessaoAtual } from '@/lib/conta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { estadoDoWhatsapp } from '@/lib/evolution';
import { cabecaLigada } from '@/lib/cabeca';
import { LIMITE_PRIMEIRAS_POR_DIA, leadsDaFila, primeirasHoje } from '@/lib/fila';
import Casca from '@/app/casca';
import Fila from './fila';

export const dynamic = 'force-dynamic';

/**
 * A fila de abordagem: os leads ainda não chamados, o mais quente primeiro.
 * A IA escreve a primeira mensagem de cada um; você revisa e envia com um
 * clique, e o próximo já aparece pronto.
 */
export default async function PaginaFila() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();

  const [itens, hoje, zap] = [
    await leadsDaFila(sessao.contaId),
    await primeirasHoje(sessao.contaId),
    await estadoDoWhatsapp().catch(() => 'inexistente' as const),
  ];

  return (
    <Casca
      tela="conversas"
      conversas
      cor="ceu"
      icone={<ListOrdered aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo="Fila de abordagem"
      subtitulo="A IA escreve a primeira mensagem de cada lead. Você confere e envia com um clique, e o próximo já aparece pronto."
      acoes={
        <Link href="/conversas" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Conversas
        </Link>
      }
    >
      <Fila
        itens={itens}
        enviadasHoje={hoje}
        limite={LIMITE_PRIMEIRAS_POR_DIA}
        whatsappLigado={zap === 'open'}
        iaLigada={cabecaLigada()}
      />
    </Casca>
  );
}
