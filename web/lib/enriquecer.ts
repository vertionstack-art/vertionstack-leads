/**
 * O filtro de precisão que roda depois da busca no Google, de graça.
 *
 * Para cada comércio que veio sem site próprio:
 *  1. empresa grande (S.A., holding, grupo) sai — não compra site de freelancer;
 *  2. segue o link que o Google tem (Linktree, bit.ly, wa.me, site fraco) e
 *     procura o WhatsApp que a própria empresa publicou;
 *  3. testa se o nome dela tem site próprio que não está no Maps
 *     (coesa.com.br, por exemplo) — se tem, não é lead;
 *  4. sem telefone, sem WhatsApp, sem rede social e sem link: sai.
 *
 * Facebook e Instagram ficam de fora de propósito: os dois recusam quem não
 * está logado, e ler por um serviço pago foi descartado (decisão de 09/10).
 */

import { lookup } from 'node:dns/promises';
import type { Lead } from './db';
import { lerPagina } from './verificar-site';
import { numeroWhatsapp, whatsappsNoTexto } from './telefone';
import { emailNoTexto } from './email-lead';

export type MotivoDescarte = 'empresa_grande' | 'site_proprio' | 'sem_contato' | 'sem_whatsapp';

/**
 * Franquias e redes: a loja da esquina com a marca de uma rede não decide
 * site nenhum — a matriz já tem. Comparado pelo nome sem acento, palavra
 * inteira. Entra na mesma conta de "empresa grande" na tela da busca.
 */
const REDES = [
  'boticario', 'cacau show', 'kopenhagen', 'brasil cacau', 'chocolates brasil cacau', 'natura', 'eudora', 'quem disse berenice', 'jequiti', 'avon',
  'mcdonalds', 'mc donalds', 'burger king', 'subway', 'habibs', 'bobs', 'giraffas', 'spoleto', 'china in box', 'dominos', 'pizza hut', 'kfc',
  'starbucks', 'outback', 'madero', 'coco bambu', 'chiquinho sorvetes', 'sodie doces', 'amor aos pedacos', 'casa do pao de queijo', 'jeronimo',
  'hering', 'renner', 'riachuelo', 'c&a', 'marisa', 'pernambucanas', 'havaianas', 'arezzo', 'schutz', 'melissa', 'lupo', 'puket', 'chilli beans',
  'vivara', 'pandora', 'imaginarium', 'centauro', 'decathlon', 'netshoes', 'polishop', 'mundo verde', 'ri happy', 'pbkids', 'tok&stok', 'tok stok', 'camicado',
  'casas bahia', 'magazine luiza', 'magalu', 'americanas', 'ponto frio', 'fast shop', 'kalunga', 'leroy merlin', 'telhanorte', 'obramax',
  'drogasil', 'droga raia', 'pague menos', 'drogaria sao paulo', 'panvel', 'ultrafarma', 'drogarias pacheco', 'extrafarma', 'nissei', 'farmacias associadas',
  'smart fit', 'smartfit', 'bluefit', 'selfit', 'bodytech', 'bio ritmo', 'just fit', 'pratique fitness',
  'otica diniz', 'oticas diniz', 'oticas carol', 'otica carol', 'chilli beans', 'oticas wanny',
  'carrefour', 'atacadao', 'assai', 'pao de acucar', 'walmart', 'sams club', 'fort atacadista', 'makro', 'mateus supermercados', 'big bompreco',
  'banco do brasil', 'caixa economica', 'bradesco', 'itau', 'santander', 'sicoob', 'sicredi', 'banrisul', 'nubank', 'correios', 'lotericas', 'casa loterica',
  'shell', 'ipiranga', 'petrobras', 'posto br', 'ale combustiveis',
  'wizard', 'fisk', 'ccaa', 'kumon', 'yazigi', 'cna', 'uniasselvi', 'anhanguera', 'estacio', 'unopar', 'unip', 'cruzeiro do sul',
  'sorridents', 'odontocompany', 'oral sin', 'dr consulta', 'hapvida', 'unimed', 'sabin', 'fleury', 'hermes pardini', 'dasa', 'a+ medicina',
  'espacolaser', 'espaco laser', 'depyl action', 'sobrancelhas design', 'jacques janine', 'emporio body store', 'la vie en rose',
  'localiza', 'unidas', 'movida', 'hertz', 
].map((r) => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

const PADRAO_REDES = new RegExp('(^|[^a-z0-9])(' + REDES.map((r) => r.replace(/[.*+?^${}()|[\]\\&]/g, (c) => (c === '&' ? '&' : '\\' + c))).join('|') + ')($|[^a-z0-9])');

export function ehRede(nome: string): boolean {
  const n = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
  return PADRAO_REDES.test(n);
}

export interface Avaliacao {
  descarte: MotivoDescarte | null;
  /** WhatsApp achado num link da própria empresa */
  whatsappLink: string | null;
  instagram: string | null;
  /** e-mail escrito no site ou no Linktree do comércio */
  email: string | null;
}

const EMPRESA_GRANDE = /(\bS\.?\s?\/?\s?A\.?$|\bS\/A\b|\bS\.A\.|\bholding\b|\bgrupo\b|\bmultinacional\b|\bincorporadora\b)/i;

const REDE_SOCIAL = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|youtube\.com|x\.com|twitter\.com|linkedin\.com)$/i;

const INSTAGRAM = /instagram\.com\/(?!p\/|reel|reels\/|explore|accounts|stories|direct|tv\/)([A-Za-z0-9_.]{2,30})/i;

const PALAVRAS_VAZIAS = new Set([
  'ltda', 'me', 'mei', 'epp', 'eireli', 'sa', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'the', 'and', 'cia', 'filial', 'matriz', 'unidade',
]);

/** palavra do ramo que muita empresa tira do domínio: "Construtora Queiroz Galvão" vira queirozgalvao.com */
const RAMO = new Set([
  'construtora', 'construcoes', 'barbearia', 'pizzaria', 'clinica', 'restaurante', 'academia', 'salao', 'studio', 'estudio', 'loja',
  'oficina', 'padaria', 'otica', 'escritorio', 'advocacia', 'advogados', 'imobiliaria', 'hamburgueria', 'cafeteria', 'empreendimentos',
  'consultoria', 'engenharia', 'comercio', 'servicos', 'auto', 'center', 'centro',
]);

/** domínio estacionado ("este domínio está à venda") não conta como site */
const ESTACIONADO = /(domain|dom[ií]nio)[^<]{0,60}(for sale|[àa] venda|is parked|estacionad|dispon[ií]vel)|sedoparking|parkingcrew|godaddy\.com\/domainsearch|hugedomains|dan\.com/i;

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function palavrasDoNome(nome: string): string[] {
  return semAcento(nome)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !PALAVRAS_VAZIAS.has(p));
}

function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** procura WhatsApp e Instagram no link que o Google trouxe no lugar do site */
async function seguirLink(site: string): Promise<{ whatsapp: string | null; instagram: string | null; email: string | null }> {
  const host = hostDe(site);
  if (!host) return { whatsapp: null, instagram: null, email: null };
  const direto = whatsappsNoTexto(site)[0] || null;
  if (direto) return { whatsapp: direto, instagram: null, email: null };
  const ig = site.match(INSTAGRAM);
  // rede social não abre para quem não está logado: guarda o perfil e para aqui
  if (REDE_SOCIAL.test(host)) return { whatsapp: null, instagram: ig ? `https://instagram.com/${ig[1]}` : null, email: null };

  const pagina = await lerPagina(site, 6000);
  if (!pagina) return { whatsapp: null, instagram: null, email: null };
  const texto = pagina.url + ' ' + pagina.html;
  const insta = texto.match(INSTAGRAM);
  return {
    whatsapp: whatsappsNoTexto(texto)[0] || null,
    instagram: insta ? `https://instagram.com/${insta[1]}` : null,
    email: emailNoTexto(pagina.html),
  };
}

/**
 * A empresa tem site com o próprio nome, só que não cadastrado no Maps?
 * Testa nomedaempresa.com.br e .com; conta como site próprio se o título da
 * página traz o nome dela e não é domínio estacionado.
 */
async function temSiteEscondido(nome: string): Promise<boolean> {
  const palavras = palavrasDoNome(nome);
  if (!palavras.length || palavras.length > 5) return false;
  const marca = palavras.filter((p) => !RAMO.has(p));
  // marca de uma palavra só ("velasco") é genérica demais: o domínio pode ser de qualquer um
  const slugs = [...new Set([palavras.length >= 2 ? palavras.join('') : '', marca.length >= 2 ? marca.join('') : ''])].filter(
    (x) => x.length >= 6 && x.length <= 30,
  );
  const dominios = slugs.flatMap((x) => [`${x}.com.br`, `${x}.com`]);
  for (const dominio of dominios) {
    try {
      await lookup(dominio);
    } catch {
      continue;
    }
    const p = await lerPagina(`https://${dominio}`, 5000);
    if (!p || !p.html || ESTACIONADO.test(p.html)) continue;
    const titulo = semAcento((p.html.match(/<title[^>]*>([^<]{0,200})/i)?.[1] || '') + ' ' + (p.html.match(/og:site_name"\s+content="([^"]{0,120})/i)?.[1] || ''));
    // o título tem de trazer a marca (as palavras que não são do ramo), não só "construtora"
    const chave = marca.length ? marca : palavras;
    const batem = chave.filter((w) => w.length > 2 && titulo.includes(w)).length;
    if (chave.length >= 2 && batem >= 2) return true;
  }
  return false;
}

export async function avaliarLead(lead: Lead, soComWhatsapp: boolean): Promise<Avaliacao> {
  const fora = (descarte: MotivoDescarte): Avaliacao => ({ descarte, whatsappLink: null, instagram: null, email: null });

  if (EMPRESA_GRANDE.test(lead.name.trim()) || ehRede(lead.name)) return fora('empresa_grande');

  const [link, escondido] = await Promise.all([
    lead.website ? seguirLink(lead.website) : Promise.resolve({ whatsapp: null, instagram: null, email: null }),
    lead.website ? Promise.resolve(false) : temSiteEscondido(lead.name).catch(() => false),
  ]);
  if (escondido) return fora('site_proprio');

  const whatsappLink = link.whatsapp ? numeroWhatsapp(link.whatsapp) : null;
  const instagram = lead.instagram || link.instagram;
  const temWhatsapp = Boolean(whatsappLink || lead.whatsapp);

  if (!lead.phone && !temWhatsapp && !instagram && !lead.website) return fora('sem_contato');
  if (soComWhatsapp && !temWhatsapp) return fora('sem_whatsapp');
  return { descarte: null, whatsappLink, instagram, email: link.email };
}

/** aplica o que a avaliação achou no lead que vai ser gravado */
export function aplicarAvaliacao(lead: Lead, a: Avaliacao): Lead {
  return {
    ...lead,
    whatsapp: a.whatsappLink || lead.whatsapp,
    whatsappFonte: a.whatsappLink ? 'link' : lead.whatsappFonte,
    instagram: a.instagram || lead.instagram,
    email: lead.email || a.email,
  };
}
