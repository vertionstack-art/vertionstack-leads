/**
 * Classificador de presenca digital.
 *
 * O Google Maps mostra um botao "Site" mesmo quando o link e um Instagram,
 * um WhatsApp ou um cardapio do iFood. Para prospeccao isso muda tudo:
 * quem so tem Instagram e lead quente, quem tem site proprio nao e.
 *
 * Resultado possivel em `kind`:
 *   none        -> nenhum link cadastrado no Maps
 *   social      -> Instagram, Facebook, WhatsApp, Linktree e afins
 *   marketplace -> iFood, Doctoralia, VivaReal, Booking... presenca alugada
 *   weak        -> site auto-gerado / construtor gratis (business.site, wix free)
 *   site        -> site proprio de verdade
 *
 * `isLead` = true significa "vale a pena abordar".
 */

const SOCIAL = [
  'instagram.com', 'instagr.am', 'facebook.com', 'fb.com', 'fb.me', 'm.me',
  'wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com',
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'linkbio.co',
  'campsite.bio', 'milkshake.app', 'lnk.bio', 'solo.to', 'taplink.cc',
  'linkbio.com.br', 'bio.site', 'many.link', 'linkme.bio',
  'youtube.com', 'youtu.be', 'tiktok.com', 'twitter.com', 'x.com',
  'threads.net', 'threads.com', 'linkedin.com', 'pinterest.com',
  'kwai.com', 'telegram.me', 't.me', 'twitch.tv'
];

const MARKETPLACE = [
  // delivery e cardapio
  'ifood.com.br', 'rappi.com.br', 'ubereats.com', 'aiqfome.com',
  'anota.ai', 'anotaai.com', 'goomer.app', 'goomer.com.br', 'cardapioweb.com',
  'menudino.com', 'abrahao.com.br', 'delivery.much.com.br', 'saipos.com',
  'pedidos10.com.br', 'neemo.com.br', 'delivery.zone', 'gendo.com.br',
  // saude
  'doctoralia.com.br', 'boaconsulta.com', 'agendarconsulta.com',
  'consultaremedios.com.br', 'zenklub.com.br', 'docway.com.br',
  // imoveis
  'vivareal.com.br', 'zapimoveis.com.br', 'imovelweb.com.br', 'olx.com.br',
  'quintoandar.com.br', 'chavesnamao.com.br', 'netimoveis.com',
  'imovelguide.com.br', 'wimoveis.com.br', 'casamineira.com.br',
  // agendamento / beleza / academia
  'booksy.com', 'trinks.com', 'belasampa.com.br', 'appbarber.com.br',
  'agendor.com.br', 'gympass.com', 'wellhub.com', 'totalpass.com.br',
  'tecnofit.com.br', 'evolux.fit', 'pactosolucoes.com.br',
  // viagem e turismo
  'booking.com', 'tripadvisor.com', 'tripadvisor.com.br', 'airbnb.com',
  'decolar.com', 'cvc.com.br', 'hoteis.com', 'expedia.com',
  // marketplaces gerais
  'mercadolivre.com.br', 'shopee.com.br', 'americanas.com.br',
  'elo7.com.br', 'catalogo.hotmart.com', 'lojasrenner.com.br'
];

const WEAK_BUILDERS = [
  'business.site', 'negocio.site', 'sites.google.com', 'blogspot.com',
  'wixsite.com', 'wix.com', 'webnode.com.br', 'webnode.page', 'jimdo.com',
  'jimdosite.com', 'wordpress.com', 'weebly.com', 'my-free.website',
  'godaddysites.com', 'square.site', 'mailchimpsites.com',
  'yolasite.com', 'ucoz.com', 'webflow.io', 'framer.website',
  'netlify.app', 'vercel.app', 'github.io', 'pages.dev',
  'lojaintegrada.com.br', 'catalogo.wa', 'nuvemshop.com.br',
  'empresassa.com.br', 'guiamais.com.br', 'apontador.com.br',
  'telelistas.net', 'solutudo.com.br', 'encontrasp.com.br'
];

const MAPS_SELF = ['google.com/maps', 'goo.gl/maps', 'maps.app.goo.gl', 'g.page'];

function hostOf(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function matches(host, url, list) {
  const full = (url || '').toLowerCase();
  return list.some((d) => host === d || host.endsWith('.' + d) || full.includes(d));
}

/**
 * @param {string|null|undefined} url o link que o Maps mostra no botao "Site"
 * @returns {{kind:string, label:string, isLead:boolean, host:string, url:string|null}}
 */
function classifyWebsite(url) {
  const clean = (url || '').trim();

  if (!clean) {
    return { kind: 'none', label: 'Sem site', isLead: true, host: '', url: null };
  }

  const host = hostOf(clean);

  if (!host) {
    return { kind: 'none', label: 'Sem site', isLead: true, host: '', url: null };
  }

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

  return { kind: 'site', label: 'Tem site próprio', isLead: false, host, url: clean };
}

// Funciona tanto no content script (window) quanto em import ES
if (typeof window !== 'undefined') {
  window.VertionClassify = { classifyWebsite, hostOf };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifyWebsite, hostOf };
}
