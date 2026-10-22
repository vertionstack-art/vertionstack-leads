/**
 * Junta o que a conversa guiada precisa saber de um lead: os dados para os
 * marcadores do roteiro (lib/mensagem) e o contexto que vai para a IA.
 * Só roda no servidor.
 */

import type { Lead } from './db';
import { db } from './sql';
import { caminhoDaProposta } from './token-proposta';
import { problemaCurto, type DadosMensagem, type Remetente } from './mensagem';
import { mensagensDaConversa, passosFeitos } from './conversa';
import type { ContextoConversa } from './ia';

export interface DadosDoLead {
  dados: DadosMensagem;
  remetente: Remetente;
  /** links completos, prontos para colar no WhatsApp */
  previa: string | null;
  proposta: string | null;
  problema: string;
  avaliacoes: string | null;
}

export async function dadosDoLead(conta: string, nomeDeQuemManda: string, lead: Lead, site: string, artigo = ''): Promise<DadosDoLead> {
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
    artigo,
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

/**
 * Quem pode usar a conversa guiada: por enquanto só a conta da Vertion
 * (CONVERSA_EMAILS na Vercel troca a lista sem mexer no código).
 */
export function podeUsarConversa(email: string | null | undefined): boolean {
  const lista = (process.env.CONVERSA_EMAILS || 'vertionstack@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && lista.includes(String(email).toLowerCase());
}

/** o contexto da conversa que vai para o Claude, nos dois modos (automático e "colar no seu plano") */
export async function contextoParaIa(
  conta: string,
  nomeDeQuemManda: string,
  lead: Lead,
  site: string,
  pedido: string,
): Promise<ContextoConversa> {
  const d = await dadosDoLead(conta, nomeDeQuemManda, lead, site);
  const mensagens = (await mensagensDaConversa(conta, lead.id)).slice(-40);
  return {
    lead: {
      nome: lead.name,
      ramo: lead.category,
      cidade: lead.city,
      problema: d.problema,
      avaliacoes: d.avaliacoes,
      previa: d.previa,
      proposta: d.proposta,
      status: lead.status,
    },
    remetente: { nome: nomeDeQuemManda, empresa: d.remetente.empresa, oferta: d.remetente.ofertaTexto || d.remetente.oferta || 'sites' },
    passosFeitos: await passosFeitos(conta, lead.id),
    mensagens: mensagens.map((m) => ({
      autor: m.autor,
      texto: m.texto,
      em: new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    })),
    pedido: pedido.trim().slice(0, 300),
  };
}
