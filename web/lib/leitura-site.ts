/**
 * O que a ferramenta consegue OBSERVAR no site de um lead, sem IA: título,
 * descrição, assuntos da página e se há caminho de contato (formulário,
 * botão de WhatsApp, telefone clicável), agendamento ou pedido de orçamento.
 *
 * Serve para a IA comercial falar do site com base em fato, e não inventar
 * diagnóstico. Cada item é "achei" ou "não achei no HTML": não achar não
 * prova que não existe (botão montado por JavaScript some do HTML), então
 * o que não foi achado vai para a IA como dúvida, nunca como defeito.
 *
 * Fica guardado no lead (site_leitura) e é relido depois de 14 dias.
 * Só roda no servidor.
 */

import type { Lead } from './db';
import { db, json } from './sql';
import { lerPagina } from './verificar-site';

export interface LeituraSite {
  url: string;
  titulo: string | null;
  descricao: string | null;
  /** os primeiros títulos da página (h1, h2): do que o site fala */
  assuntos: string[];
  formulario: boolean;
  whatsapp: boolean;
  telefoneClicavel: boolean;
  email: boolean;
  /** fala de agendar, marcar horário, consulta */
  agendamento: boolean;
  /** fala de orçamento, cotação */
  orcamento: boolean;
  /** tem a etiqueta que deixa a página certa no celular */
  celular: boolean;
  instagram: boolean;
  /** caracteres de texto visível: página com pouco texto quase sempre é montada por JavaScript */
  texto: number;
  /** a leitura funcionou (false = o site não abriu para leitura; não é defeito) */
  lido: boolean;
}

const VALIDADE_DIAS = 14;

const limpar = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8211;|&ndash;/g, '–').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

function textoVisivel(html: string): string {
  return limpar(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

/** lê o HTML e anota o que dá para afirmar */
export function analisarHtml(url: string, html: string): LeituraSite {
  const h = html.slice(0, 400_000);
  const texto = textoVisivel(h);
  const t = texto.toLowerCase();
  const meta = (nome: string) =>
    h.match(new RegExp(`<meta[^>]+(?:name|property)=["']${nome}["'][^>]*content=["']([^"']{3,300})`, 'i'))?.[1] ||
    h.match(new RegExp(`<meta[^>]+content=["']([^"']{3,300})["'][^>]*(?:name|property)=["']${nome}["']`, 'i'))?.[1] ||
    null;
  const assuntos = [...h.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => limpar(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((x) => x.length >= 3 && x.length <= 90)
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 8);
  const titulo = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    url,
    titulo: titulo ? limpar(titulo).slice(0, 140) || null : null,
    descricao: meta('description') ? limpar(meta('description')!).slice(0, 220) : meta('og:description') ? limpar(meta('og:description')!).slice(0, 220) : null,
    assuntos,
    formulario: /<form[\s>]/i.test(h) || /wpcf7|elementor-form|gform_|forminator|typeform|jotform|forms\.gle|docs\.google\.com\/forms/i.test(h),
    whatsapp: /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|chat\.whatsapp/i.test(h),
    telefoneClicavel: /href=["']tel:/i.test(h),
    email: /href=["']mailto:/i.test(h),
    agendamento: /agend(e|ar|amento)|marque\s+(sua|seu|uma)|marcar\s+(hor[áa]rio|consulta|avalia[çc][ãa]o)|reserv(e|ar)\s|calendly|doctoralia|booksy|trinks|simplesagenda/i.test(t + ' ' + h.slice(0, 50_000)),
    orcamento: /or[çc]amento|cota[çc][ãa]o|solicite\s+(uma\s+)?proposta|pe[çc]a\s+(uma\s+)?proposta/i.test(t),
    celular: /<meta[^>]+name=["']viewport["']/i.test(h),
    instagram: /instagram\.com\/[a-z0-9_.]/i.test(h),
    texto: texto.length,
    lido: true,
  };
}

export async function lerSite(url: string): Promise<LeituraSite> {
  const alvo = url.startsWith('http') ? url : 'https://' + url;
  const p = await lerPagina(alvo, 8000);
  if (!p || !p.html) {
    return { url: alvo, titulo: null, descricao: null, assuntos: [], formulario: false, whatsapp: false, telefoneClicavel: false, email: false, agendamento: false, orcamento: false, celular: false, instagram: false, texto: 0, lido: false };
  }
  return analisarHtml(p.url || alvo, p.html);
}

/** sites que a ferramenta já sabe que não abrem: não adianta ler */
const NAO_LER = ['fora_do_ar', 'nao_encontrado', 'certificado_vencido', 'virou_social'];

/**
 * A leitura do site deste lead: a guardada, se tem menos de 14 dias, ou uma
 * nova. null quando o lead não tem site próprio que abra.
 */
export async function leituraDoLead(conta: string, lead: Lead): Promise<LeituraSite | null> {
  if (!lead.website || lead.websiteKind !== 'site' || NAO_LER.includes(lead.siteStatus || '')) return null;
  const [r] = await db()`select site_leitura, site_lido_em from leads where conta_id = ${conta} and id = ${lead.id}`;
  const guardada = json<LeituraSite>(r?.site_leitura);
  const idade = r?.site_lido_em ? (Date.now() - new Date(r.site_lido_em).getTime()) / 86_400_000 : Infinity;
  if (guardada && idade < VALIDADE_DIAS) return guardada;
  const nova = await lerSite(lead.website);
  await db()`update leads set site_leitura = ${JSON.stringify(nova)}::jsonb, site_lido_em = now() where conta_id = ${conta} and id = ${lead.id}`;
  return nova;
}
