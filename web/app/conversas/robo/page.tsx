import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Bot } from 'lucide-react';
import { sessaoAtual } from '@/lib/conta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { CATALOGO } from '@/lib/catalogo';
import { cabecaLigada } from '@/lib/cabeca';
import { escritaDoDono, treinoDoRobo } from '@/lib/robo';
import Casca from '@/app/casca';
import TreinoRobo from './treino';

export const dynamic = 'force-dynamic';

/**
 * Treinar o robô de vendas: quem ele é, o jeito de escrever, o que a empresa
 * faz, as perguntas de sempre e as regras; ao lado, um chat para testar
 * fazendo o papel do cliente e corrigir o que ele responder mal.
 */
export default async function PaginaTreino() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();

  const t = await treinoDoRobo(sessao.contaId);
  const escrita = await escritaDoDono(sessao.contaId);

  return (
    <Casca
      tela="conversas"
      conversas
      cor="lavanda"
      icone={<Bot aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo="Treinar o robô"
      subtitulo="Ensine quem ele é, como você escreve e o que a Vertion faz. Teste ao lado antes de soltar nos clientes."
      acoes={
        <Link href="/conversas" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Conversas
        </Link>
      }
    >
      <TreinoRobo
        inicial={t.cfg}
        empresa={t.empresa}
        oferta={t.oferta}
        escritaAprendida={escrita}
        catalogo={CATALOGO.filter((s) => s.familia !== 'cortesia').map((s) => s.nome)}
        iaLigada={cabecaLigada()}
      />
    </Casca>
  );
}
