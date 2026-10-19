/**
 * Junta o que a conversa guiada precisa saber de um lead: os dados para os
 * marcadores do roteiro (lib/mensagem) e o contexto que vai para a IA.
 * Só roda no servidor.
 */

import type { Lead } from './db';
import { db } from './sql';
import { caminhoDaProposta } from './token-proposta';
import { problemaCurto, type DadosMensagem, type Remetente } from './mensagem';

export interface DadosDoLead {
  dados: DadosMensagem;
  remetente: Remetente;
  /** links completos, prontos para colar no WhatsApp */
  previa: string | null;
  proposta: string | null;
  problema: string;
  avaliacoes: string | null;
}

export async function dadosDoLead(conta: string, nomeDeQuemManda: string, lead: Lead, site: string): Promise<DadosDoLead> {
  const [c] = await db()`select empresa_nome, oferta, oferta_texto from contas where id = ${conta}`;
  // a prévia já fica no lead como link completo (api/leads/[id]/previa)
  const linkPrevia = lead.previaUrl || null;
  const proposta = lead.proposta && typeof lead.proposta === 'object' ? site + caminhoDaProposta(conta, lead.id) : null;

  const dados: DadosMensagem = {
    nome: lead.name,
    category: lead.category,
    city: lead.city,
    websiteKind: lead.websiteKind,
    website: lead.website,
    siteStatus: lead.siteStatus,
    rating: lead.rating,
    reviews: lead.reviews,
    instagram: lead.instagram,
    previaUrl: linkPrevia,
    oferta: lead.oferta,
    fotosGoogle: lead.fotosGoogle,
    semAnuncio: lead.semAnuncio,
  };
  const remetente: Remetente = {
    nome: nomeDeQuemManda,
    empresa: (c?.empresa_nome as string) || null,
    oferta: (c?.oferta as string) || 'sites',
    ofertaTexto: (c?.oferta_texto as string) || null,
  };
  return {
    dados,
    remetente,
    previa: linkPrevia,
    proposta,
    problema: problemaCurto(dados),
    avaliacoes: lead.rating && lead.reviews ? `${lead.rating.toFixed(1).replace('.', ',')} estrelas, ${lead.reviews} avaliações` : null,
  };
}
