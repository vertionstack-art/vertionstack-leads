/**
 * Junta, do banco, tudo que o copiloto comercial e o robô precisam saber de
 * um lead: os dados, a leitura do site, a conversa (com a resposta
 * automática marcada) e a ficha comercial (lib/comercial). Só roda no servidor.
 */

import type { Lead } from './db';
import { mensagensDaConversa } from './conversa';
import { dadosDoLead } from './conversa-contexto';
import { eu } from './mensagem';
import { valores, type CfgProposta } from './financeiro';
import { rotuloDoInteresse } from './interesses';
import { leituraDoLead, type LeituraSite } from './leitura-site';
import { ehAutomatica, segundosDepois } from './automatica';
import { fichaComercial, type FalaComercial, type FichaComercial, type LeadComercial } from './comercial';
import { linksDoPortfolio } from './robo-config';
import { treinoDoRobo } from './robo';
import type { EntradaCopiloto, Tarefa, Tom } from './copiloto';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function briefingEmTexto(b: unknown): string | null {
  if (!b || typeof b !== 'object') return null;
  const x = b as { servicos?: string; diferenciais?: string; destaque?: string };
  const partes = [
    x.servicos?.trim() && `serviços: ${x.servicos.trim().replace(/\s*\n\s*/g, '; ')}`,
    x.diferenciais?.trim() && `diferenciais: ${x.diferenciais.trim()}`,
    x.destaque?.trim() && `quer destacar: ${x.destaque.trim()}`,
  ].filter(Boolean);
  return partes.length ? partes.join('. ').slice(0, 500) : null;
}

export function leadComercialDe(lead: Lead): LeadComercial {
  return {
    nome: lead.name,
    tipo: lead.tipo,
    ramo: lead.category,
    cidade: lead.city,
    status: lead.status,
    websiteKind: lead.websiteKind,
    website: lead.website,
    siteStatus: lead.siteStatus,
    siteDetalhe: lead.siteDetalhe,
    rating: lead.rating,
    reviews: lead.reviews,
    instagram: Boolean(lead.instagram),
    semAnuncio: lead.semAnuncio,
    chamouPrimeiro: lead.origem === 'whatsapp',
    interesse: lead.interesse.map(rotuloDoInteresse),
    ideia: lead.ideia,
    briefing: briefingEmTexto(lead.briefing),
    notas: lead.notes,
    temPrevia: Boolean(lead.previaUrl),
    temProposta: Boolean(lead.proposta && typeof lead.proposta === 'object'),
    propostaAberturas: lead.propostaAberturas || 0,
    lembreteEm: lead.lembreteEm,
    lembreteTexto: lead.lembreteTexto,
  };
}

/** a conversa com a resposta automática do WhatsApp Business marcada (mesma regra do robô) */
export function conversaComercial(mensagens: { autor: 'eu' | 'cliente'; texto: string; em: string }[], chamouPrimeiro: boolean): FalaComercial[] {
  let nossaAnterior: string | null = null;
  return mensagens.map((m) => {
    const automatica = m.autor === 'cliente' && !(chamouPrimeiro && !nossaAnterior) && ehAutomatica(m.texto, segundosDepois(m.em, nossaAnterior));
    if (m.autor === 'eu') nossaAnterior = m.em;
    return { autor: m.autor, texto: m.texto, em: m.em, automatica };
  });
}

export interface FichaDoLead {
  ficha: FichaComercial;
  leitura: LeituraSite | null;
  conversa: FalaComercial[];
}

export async function fichaDoLead(conta: string, lead: Lead): Promise<FichaDoLead> {
  const [leitura, mensagens] = await Promise.all([
    // ler o site é opcional: se falhar, a ficha sai sem a leitura
    leituraDoLead(conta, lead).catch(() => null),
    mensagensDaConversa(conta, lead.id),
  ]);
  const conversa = conversaComercial(mensagens.slice(-60), lead.origem === 'whatsapp');
  return { ficha: fichaComercial(leadComercialDe(lead), leitura, conversa), leitura, conversa };
}

export async function entradaDoCopiloto(
  conta: string,
  lead: Lead,
  o: { tarefa: Tarefa; tom: Tom; pedido: string; anteriores: string[]; variacao: string | null; nome: string; artigo: string; site: string },
): Promise<EntradaCopiloto> {
  const [t, d, f] = await Promise.all([treinoDoRobo(conta), dadosDoLead(conta, o.nome, lead, o.site, o.artigo), fichaDoLead(conta, lead)]);
  const v = valores(lead.proposta as CfgProposta | null);
  return {
    tarefa: o.tarefa,
    tom: o.tom,
    pedido: o.pedido,
    cfg: t.cfg,
    empresa: t.empresa,
    oferta: t.oferta,
    quem: eu(d.remetente),
    nomeLead: lead.name,
    tipoLead: lead.tipo,
    ficha: f.ficha,
    conversa: f.conversa.map((m) => ({
      autor: m.autor,
      texto: m.texto,
      automatica: m.automatica,
      quando: new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    })),
    anteriores: o.anteriores,
    variacao: o.variacao,
    previa: d.previa,
    proposta: d.proposta,
    valores: v && (v.entrada || v.mensalidade) ? `entrada ${brl(v.entrada)}${v.mensalidade ? `, mensalidade ${brl(v.mensalidade)}` : ', sem mensalidade'}` : null,
    links: [d.previa, d.proposta, ...linksDoPortfolio(t.cfg)].filter((x): x is string => Boolean(x)),
  };
}
