import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { sessaoAtual } from '@/lib/conta';
import { buscarLead } from '@/lib/db';
import { numeroWhatsapp } from '@/lib/telefone';
import { mensagensDaConversa, passosFeitos } from '@/lib/conversa';
import { dadosDoLead, podeUsarConversa } from '@/lib/conversa-contexto';
import { usoDaIa } from '@/lib/ia';
import ConversaGuiada from './conversa';
import Casca from '@/app/casca';
import { ArrowLeft, MessagesSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Conversa guiada do WhatsApp com um lead: o roteiro do primeiro "oi" até a
 * venda, as respostas prontas para objeções, o registro da conversa e a IA
 * que sugere a próxima mensagem. Por enquanto só a conta da Vertion vê.
 */
export default async function PaginaConversa({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();

  const { id } = await params;
  const idLead = decodeURIComponent(id).slice(0, 300);
  const lead = await buscarLead(sessao.contaId, idLead);
  if (!lead) notFound();

  const h = await headers();
  const site = process.env.SITE_URL?.replace(/\/$/, '') || `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`;
  const d = await dadosDoLead(sessao.contaId, sessao.nome, lead, site);
  const mensagens = await mensagensDaConversa(sessao.contaId, idLead);
  const passos = await passosFeitos(sessao.contaId, idLead);
  const uso = await usoDaIa(sessao.contaId);
  const numero = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));

  return (
    <Casca
      tela="conversas"
      conversas
      cor="rosa"
      icone={<MessagesSquare aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={lead.name}
      subtitulo={
        <>
          {[lead.category, lead.city].filter(Boolean).join(' · ')}
          {lead.phone ? ` · ${lead.phone}` : ''}
          {' · '}
          <span className="font-semibold text-tinta">{d.problema}</span>
        </>
      }
      acoes={
        <Link href="/conversas" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Todas as conversas
        </Link>
      }
    >
        <ConversaGuiada
          leadId={idLead}
          numero={numero}
          dados={d.dados}
          remetente={d.remetente}
          proposta={d.proposta}
          mensagensIniciais={mensagens}
          passosIniciais={passos}
          usoInicial={uso}
          statusLead={lead.status}
        />
    </Casca>
  );
}
