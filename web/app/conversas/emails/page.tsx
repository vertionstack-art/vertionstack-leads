import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';
import { sessaoAtual } from '@/lib/conta';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { cabecaLigada } from '@/lib/cabeca';
import { candidatosEmail, emailsDaConta } from '@/lib/email-frio-fila';
import { enviadosHoje, gmailLigado, tetoPorDia } from '@/lib/email-frio';
import Casca from '@/app/casca';
import Emails from './emails';

export const dynamic = 'force-dynamic';

/**
 * A fila de e-mails do exterior: a IA escreve um e-mail por empresa, você
 * lê, ajusta e aprova; o envio sai pelo seu Gmail no horário comercial de lá.
 */
export default async function PaginaEmails() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();

  const [candidatos, emails, hoje] = await Promise.all([candidatosEmail(sessao.contaId), emailsDaConta(sessao.contaId), enviadosHoje()]);

  return (
    <Casca
      tela="conversas"
      conversas
      cor="lavanda"
      icone={<Mail aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo="E-mails do exterior"
      subtitulo="Um e-mail por empresa, escrito pela IA em inglês. Você lê, ajusta e aprova; ele sai pelo seu Gmail no horário comercial de lá."
      acoes={
        <Link href="/conversas" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Conversas
        </Link>
      }
    >
      <Emails candidatosIniciais={candidatos} emailsIniciais={emails} enviadosHoje={hoje} teto={tetoPorDia()} gmail={gmailLigado()} ia={cabecaLigada()} />
    </Casca>
  );
}
