import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { sessaoAtual } from '@/lib/conta';
import { buscarLead } from '@/lib/db';
import { numeroWhatsapp } from '@/lib/telefone';
import { mensagensDaConversa, passosFeitos } from '@/lib/conversa';
import { dadosDoLead } from '@/lib/conversa-contexto';
import { usoDaIa } from '@/lib/ia';
import ConversaGuiada from './conversa';

export const dynamic = 'force-dynamic';

/**
 * Conversa guiada do WhatsApp com um lead: o roteiro do primeiro "oi" até a
 * venda, as respostas prontas para objeções, o registro da conversa e a IA
 * que sugere a próxima mensagem. Por enquanto só o administrador vê.
 */
export default async function PaginaConversa({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!sessao.admin) notFound();

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
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1440px] flex-col rounded-[var(--radius-folha)] bg-white px-4 pb-6 pt-6 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-zinc-500">Conversa guiada</p>
            <h1 className="mt-1 truncate text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">{lead.name}</h1>
            <p className="mt-1 text-[13px] font-medium text-zinc-500">
              {[lead.category, lead.city].filter(Boolean).join(' · ')}
              {lead.phone ? ` · ${lead.phone}` : ''}
              {' · '}
              <span className="text-zinc-700">{d.problema}</span>
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
            Voltar ao painel
          </Link>
        </header>
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
      </div>
    </div>
  );
}
