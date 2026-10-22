import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { sessaoAtual } from '@/lib/conta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { estadoDoWhatsapp } from '@/lib/evolution';
import Casca from '@/app/casca';
import ConexaoWhatsapp from './conexao';

export const dynamic = 'force-dynamic';

/** ligar e desligar o WhatsApp da Vertion da ferramenta (QR code da Evolution API) */
export default async function PaginaWhatsapp() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();
  const estado = await estadoDoWhatsapp().catch(() => 'inexistente' as const);

  return (
    <Casca
      tela="conversas"
      conversas
      cor="menta"
      icone={<Smartphone aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo="WhatsApp da Vertion"
      subtitulo="Ligue o número à ferramenta para enviar com um clique e receber as respostas dos leads na aba Conversas."
      acoes={
        <Link href="/conversas" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Conversas
        </Link>
      }
    >
      <ConexaoWhatsapp estadoInicial={estado} />
    </Casca>
  );
}
