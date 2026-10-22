import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { MessagesSquare, Smartphone } from 'lucide-react';
import { estadoDoWhatsapp } from '@/lib/evolution';
import { sessaoAtual } from '@/lib/conta';
import { daLinha } from '@/lib/db';
import { db } from '@/lib/sql';
import { numeroWhatsapp } from '@/lib/telefone';
import { temperaturaDoLead } from '@/lib/temperatura';
import { resumoDasConversas } from '@/lib/conversa';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { TODOS_OS_PASSOS } from '@/lib/roteiro';
import Casca from '@/app/casca';
import ListaConversas, { type ItemConversa } from './lista';

export const dynamic = 'force-dynamic';

const MAX_LEADS = 600;

/**
 * Todas as conversas do WhatsApp num lugar só: os leads captados, separados
 * pelo que pede ação agora (o cliente respondeu e espera você), o que espera
 * o cliente e o que ainda nem começou. Cada um abre a conversa guiada.
 */
export default async function PaginaConversas() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  if (!podeUsarConversa(sessao.email)) notFound();

  const linhas = await db()`
    select * from leads
    where conta_id = ${sessao.contaId} and status <> 'descartado'
    order by updated_at desc
    limit ${MAX_LEADS}
  `;
  const resumo = await resumoDasConversas(sessao.contaId);
  const zap = await estadoDoWhatsapp().catch(() => 'inexistente' as const);

  const itens: ItemConversa[] = linhas.map((r) => {
    const lead = daLinha(r);
    const c = resumo.get(lead.id);
    const t = temperaturaDoLead(lead);
    return {
      id: lead.id,
      nome: lead.name,
      ramo: lead.category,
      cidade: lead.city,
      status: lead.status,
      temperatura: t.nivel,
      pontos: t.pontos,
      temWhatsapp: Boolean(lead.whatsapp || (lead.telefoneTipo !== 'fixo' && numeroWhatsapp(lead.phone))),
      mensagens: c?.mensagens || 0,
      ultimaEm: c?.ultimaEm || null,
      ultimoAutor: c?.ultimoAutor || null,
      ultimoTexto: c?.ultimoTexto || null,
      passos: c?.passos || 0,
    };
  });

  return (
    <Casca
      tela="conversas"
      conversas
      cor="rosa"
      icone={<MessagesSquare aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo="Conversas"
      subtitulo="Seus leads no WhatsApp, do primeiro oi até a venda. Quem respondeu aparece primeiro."
      acoes={
        <Link
          href="/conversas/whatsapp"
          className={`inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors ${
            zap === 'open' ? 'bg-menta text-emerald-950 hover:bg-emerald-200' : 'bg-tinta text-white hover:bg-tinta-70'
          }`}
        >
          <Smartphone aria-hidden className="h-4 w-4" />
          {zap === 'open' ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
        </Link>
      }
    >
      <ListaConversas itens={itens} totalPassos={TODOS_OS_PASSOS.length} />
    </Casca>
  );
}
