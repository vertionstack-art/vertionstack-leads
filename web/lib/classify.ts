/**
 * Classifica o endereço que o comércio cadastrou no Google: site próprio,
 * rede social, marketplace, construtor grátis ou nada.
 */

export type WebsiteKind = 'none' | 'social' | 'marketplace' | 'weak' | 'site';

export interface Veredito {
  kind: WebsiteKind;
  label: string;
  isLead: boolean;
  host: string;
  url: string | null;
}

const SOCIAL = [
  'instagram.com', 'instagr.am', 'facebook.com', 'fb.com', 'fb.me', 'm.me',
  'wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'linkbio.co',
  'campsite.bio', 'milkshake.app', 'lnk.bio', 'solo.to', 'taplink.cc',
  'linkbio.com.br', 'bio.site', 'many.link', 'linkme.bio',
  'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com',
  'threads.net', 'threads.com', 'linkedin.com', 'pinterest.com',
  'kwai.com', 'telegram.me', 't.me', 'twitch.tv',
  // geradores de link de WhatsApp: não são site, só abrem a conversa
  'wa.link', 'walink.co', 'zapzap.link', 'linkdozap.com', 'zap.ly', 'zapr.link',
  // páginas de links ("link na bio")
  'linkin.bio', 'linklist.bio', 'msha.ke', 'allmylinks.com', 'hoo.be', 'linkr.bio',
  'direct.me', 'linkfly.to', 'linke.to', 'bento.me', 'koji.to', 'shor.by', 'urlgeni.us',
];

/**
 * Encurtadores e geradores de QR: o endereço não diz nada, quem decide é o
 * destino. A busca segue o link (lib/verificar-site); se não der para saber
 * para onde vai, o comércio entra como "link encurtado", não como site.
 */
const ENCURTADORES = [
  'bit.ly', 'bitly.com', 'bitly.ws', 'bit.do', 'tinyurl.com', 'tiny.cc', 'tiny.one', 'cutt.ly',
  'is.gd', 'v.gd', 'rebrand.ly', 'rb.gy', 'ow.ly', 't.co', 'goo.gl', 'shorturl.at', 's.id',
  'encurtador.com.br', 'abre.ai', 'l.ead.me', 'migre.me', '1url.com.br', 'encr.pw', 'chilp.it',
  'short.io', 'shorte.st', 'buff.ly', 'lnkd.in', 'adf.ly', 'u.to', 'clck.ru', 'surl.li',
  'qrco.de', 'qr.page', 'me-qr.com', 'qrcodechimp.com', 'qr-code-generator.com', 'qrfy.io',
  'beacons.page', 'linktw.in', 'kutt.it', 'gg.gg', 'tr.ee', 'sl.run',
];

const MARKETPLACE = [
  'ifood.com.br', 'rappi.com.br', 'ubereats.com', 'aiqfome.com',
  'anota.ai', 'anotaai.com', 'goomer.app', 'goomer.com.br', 'cardapioweb.com',
  'menudino.com', 'abrahao.com.br', 'saipos.com', 'pedidos10.com.br',
  'neemo.com.br', 'delivery.zone', 'gendo.com.br',
  'doctoralia.com.br', 'boaconsulta.com', 'agendarconsulta.com',
  'consultaremedios.com.br', 'zenklub.com.br', 'docway.com.br',
  'vivareal.com.br', 'zapimoveis.com.br', 'imovelweb.com.br', 'olx.com.br',
  'quintoandar.com.br', 'chavesnamao.com.br', 'netimoveis.com',
  'imovelguide.com.br', 'wimoveis.com.br', 'casamineira.com.br',
  'booksy.com', 'trinks.com', 'belasampa.com.br', 'appbarber.com.br',
  'gympass.com', 'wellhub.com', 'totalpass.com.br', 'tecnofit.com.br',
  'evolux.fit', 'pactosolucoes.com.br',
  'booking.com', 'tripadvisor.com', 'tripadvisor.com.br', 'airbnb.com',
  'decolar.com', 'cvc.com.br', 'hoteis.com', 'expedia.com',
  'mercadolivre.com.br', 'shopee.com.br', 'americanas.com.br',
  'elo7.com.br', 'lojasrenner.com.br',
];

const WEAK_BUILDERS = [
  'business.site', 'negocio.site', 'sites.google.com', 'blogspot.com',
  'wixsite.com', 'wix.com', 'webnode.com.br', 'webnode.page', 'jimdo.com',
  'jimdosite.com', 'wordpress.com', 'weebly.com', 'my-free.website',
  'godaddysites.com', 'square.site', 'mailchimpsites.com',
  'yolasite.com', 'ucoz.com', 'webflow.io', 'framer.website',
  'netlify.app', 'vercel.app', 'github.io', 'pages.dev',
  'lojaintegrada.com.br', 'nuvemshop.com.br',
  'guiamais.com.br', 'apontador.com.br', 'telelistas.net', 'solutudo.com.br',
];

const MAPS_SELF = ['google.com/maps', 'goo.gl/maps', 'maps.app.goo.gl', 'g.page'];

export function hostOf(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function matches(host: string, url: string, list: string[]): boolean {
  const full = url.toLowerCase();
  return list.some((d) => host === d || host.endsWith('.' + d) || full.includes(d));
}

/** o endereço é de um encurtador (bit.ly, encurtador.com.br, QR code...) */
export function ehEncurtador(url?: string | null): boolean {
  if (!url) return false;
  const clean = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  const host = hostOf(clean);
  return Boolean(host) && ENCURTADORES.some((d) => host === d || host.endsWith('.' + d));
}

export function classifyWebsite(url?: string | null): Veredito {
  const bruto = (url || '').trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  // só http(s) ou um domínio puro ("barbearia.com.br") vira link; "javascript:..." e afins não
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(bruto);
  if (!bruto || (temEsquema && !/^https?:\/\//i.test(bruto))) return { kind: 'none', label: 'Sem site', isLead: true, host: '', url: null };
  const clean = temEsquema ? bruto : 'https://' + bruto.replace(/^\/+/, '');

  const host = hostOf(clean);
  if (!host) return { kind: 'none', label: 'Sem site', isLead: true, host: '', url: null };

  if (matches(host, clean, MAPS_SELF)) {
    return { kind: 'none', label: 'Sem site (só o Maps)', isLead: true, host, url: clean };
  }
  if (matches(host, clean, SOCIAL)) {
    return { kind: 'social', label: 'Só rede social', isLead: true, host, url: clean };
  }
  if (matches(host, clean, MARKETPLACE)) {
    return { kind: 'marketplace', label: 'Só marketplace', isLead: true, host, url: clean };
  }
  if (matches(host, clean, WEAK_BUILDERS)) {
    return { kind: 'weak', label: 'Site fraco / gratuito', isLead: true, host, url: clean };
  }
  // ainda não dá para saber: a verificação segue o link e decide pelo destino
  if (ehEncurtador(clean)) {
    return { kind: 'site', label: 'Link encurtado', isLead: false, host, url: clean };
  }
  return { kind: 'site', label: 'Tem site próprio', isLead: false, host, url: clean };
}

export const KIND_META: Record<WebsiteKind, { label: string; curto: string; cor: string }> = {
  none: { label: 'Sem site', curto: 'Sem site', cor: 'verde' },
  social: { label: 'Só rede social', curto: 'Só social', cor: 'verde' },
  marketplace: { label: 'Só marketplace', curto: 'Marketplace', cor: 'ambar' },
  weak: { label: 'Site fraco / gratuito', curto: 'Site fraco', cor: 'ambar' },
  site: { label: 'Tem site próprio', curto: 'Tem site', cor: 'cinza' },
};
