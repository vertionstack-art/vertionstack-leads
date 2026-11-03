/**
 * As redes que a empresa publica no próprio site, e o tamanho do digital
 * dela a partir do que já sabemos.
 *
 * Existe para o preço lá fora: o Lucas cobra conforme o porte, e para isso
 * precisa abrir o Instagram, o Facebook, o Yelp de cada empresa. Aqui só
 * se guarda o link que a empresa colocou no site (nada é adivinhado), e o
 * porte é uma estimativa com os motivos à mostra, não uma verdade.
 */

import type { Lead } from './db';

export type Rede = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'x' | 'yelp' | 'pinterest' | 'nextdoor';
export type Redes = Partial<Record<Rede, string>>;

export const NOME_DA_REDE: Record<Rede, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  yelp: 'Yelp',
  pinterest: 'Pinterest',
  nextdoor: 'Nextdoor',
};

/** padrão do perfil em cada rede; links de compartilhar, plugin e login ficam de fora */
const PERFIS: [Rede, RegExp][] = [
  ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel|explore|accounts|stories|direct|tv\/|sharer)([A-Za-z0-9_.]{2,30})\/?/i],
  ['facebook', /https?:\/\/(?:www\.|m\.|business\.)?(?:facebook|fb)\.com\/(?!sharer|share|plugins|dialog|tr\?|tr\/|login|privacy|policies|help|events\/|groups\/|watch)((?:pages\/)?[A-Za-z0-9_.\-/]{2,80}?|profile\.php\?id=\d+)\/?(?=["'?#\s<]|$)/i],
  ['linkedin', /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/([A-Za-z0-9_\-%.]{2,80})\/?/i],
  ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{2,30})/i],
  ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)([A-Za-z0-9_\-.]{2,80})/i],
  ['x', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home|i\/)([A-Za-z0-9_]{2,15})\/?(?=["'?#\s<]|$)/i],
  ['yelp', /https?:\/\/(?:www\.|m\.)?yelp\.[a-z.]{2,6}\/biz\/([A-Za-z0-9_\-%]{2,120})/i],
  ['pinterest', /https?:\/\/(?:[a-z]{2,3}\.)?pinterest\.[a-z.]{2,6}\/(?!pin\/)([A-Za-z0-9_]{2,40})\/?(?=["'?#\s<]|$)/i],
  ['nextdoor', /https?:\/\/(?:www\.)?nextdoor\.com\/(?:pages|page)\/([A-Za-z0-9_\-]{2,120})/i],
];

/** os perfis que aparecem num HTML (ou num link solto), o primeiro de cada rede */
export function redesNoTexto(texto: string): Redes {
  const r: Redes = {};
  for (const [rede, re] of PERFIS) {
    const m = texto.match(re);
    if (m) r[rede] = m[0].replace(/["'<\s].*$/, '').replace(/\/+$/, '');
  }
  return r;
}

export type Porte = 'pequeno' | 'medio' | 'grande';

export interface TamanhoDigital {
  porte: Porte;
  /** o que pesou, em português, para mostrar ao lado */
  motivos: string[];
}

/**
 * Porte estimado pelo que a busca já trouxe: quantas avaliações no Google
 * (o melhor sinal de quantos clientes passam por lá), quantas redes ela
 * mantém e se já tem site. É só um ponto de partida para o preço.
 */
export function tamanhoDigital(lead: Pick<Lead, 'reviews' | 'rating' | 'website' | 'websiteKind' | 'siteNota' | 'instagram'> & { redes?: Redes | null }): TamanhoDigital {
  const motivos: string[] = [];
  let pontos = 0;
  const av = lead.reviews ?? 0;
  if (av >= 300) {
    pontos += 3;
    motivos.push(`${av} avaliações no Google: muito movimento`);
  } else if (av >= 80) {
    pontos += 2;
    motivos.push(`${av} avaliações no Google: movimento bom`);
  } else if (av >= 20) {
    pontos += 1;
    motivos.push(`${av} avaliações no Google`);
  } else {
    motivos.push(av ? `só ${av} avaliações no Google` : 'sem avaliações no Google');
  }
  const redes = Object.keys({ ...(lead.redes || {}), ...(lead.instagram ? { instagram: lead.instagram } : {}) }).length;
  if (redes >= 4) {
    pontos += 2;
    motivos.push(`${redes} redes sociais`);
  } else if (redes >= 2) {
    pontos += 1;
    motivos.push(`${redes} redes sociais`);
  } else {
    motivos.push(redes ? '1 rede social' : 'nenhuma rede achada no site');
  }
  if (lead.websiteKind === 'site' && lead.website) {
    pontos += 1;
    motivos.push(lead.siteNota !== null && lead.siteNota !== undefined ? `já tem site (nota ${String(lead.siteNota).replace('.', ',')})` : 'já tem site');
  } else {
    motivos.push('sem site próprio');
  }
  return { porte: pontos >= 5 ? 'grande' : pontos >= 3 ? 'medio' : 'pequeno', motivos };
}

export const NOME_DO_PORTE: Record<Porte, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };
