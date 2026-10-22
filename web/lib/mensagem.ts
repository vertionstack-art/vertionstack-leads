/**
 * A primeira mensagem do WhatsApp, já escrita a partir do que a ferramenta
 * sabe do comércio: o problema do site (ou a falta dele), as avaliações e a
 * prévia, quando existe. É um ponto de partida — a pessoa revisa e edita
 * antes de abrir o WhatsApp, e o envio é sempre ela que faz (nada sai
 * sozinho; ver o projeto WhatsApp Vertion).
 *
 * Roda no navegador e no servidor: não importa nada do banco.
 */

export interface DadosMensagem {
  nome: string;
  category: string | null;
  city: string | null;
  websiteKind: string;
  website: string | null;
  siteStatus: string | null;
  rating: number | null;
  reviews: number | null;
  instagram: string | null;
  previaUrl: string | null;
  /** para qual oferta o lead foi achado (lib/ofertas); ausente = sites */
  oferta?: string;
  fotosGoogle?: number | null;
  semAnuncio?: boolean | null;
}

export interface Remetente {
  /** primeiro nome de quem manda */
  nome: string;
  /** "o" ou "a" antes do nome ("Aqui é o Lucas"), escolhido em Meu perfil; vazio = sem artigo */
  artigo?: string;
  empresa: string | null;
  /** o que a pessoa vende (lib/ofertas) e, em "outro", a frase dela */
  oferta?: string;
  ofertaTexto?: string | null;
}

const TRABALHO: Record<string, string> = {
  sites: 'trabalho com criação de sites',
  social: 'cuido de redes sociais de comércios aqui da região',
  trafego: 'trabalho com tráfego pago e anúncios',
  design: 'trabalho com design e identidade visual',
  empresas: 'atendo empresas aqui da região',
};

const MARKETPLACES: [RegExp, string][] = [
  [/ifood/i, 'iFood'],
  [/rappi/i, 'Rappi'],
  [/doctoralia/i, 'Doctoralia'],
  [/booksy/i, 'Booksy'],
  [/trinks/i, 'Trinks'],
  [/vivareal|zapimoveis|olx|imovelweb/i, 'portal de imóveis'],
  [/booking|airbnb|tripadvisor/i, 'Booking'],
  [/mercadolivre|shopee|elo7/i, 'marketplace'],
];

function plataforma(site: string | null): string {
  for (const [re, nome] of MARKETPLACES) if (site && re.test(site)) return nome;
  return 'aplicativo de terceiros';
}

const primeiroNome = (s: string) => {
  const p = s.trim().split(/\s+/)[0] || '';
  return p.charAt(0).toUpperCase() + p.slice(1);
};

/** "o Lucas", "a Ana" ou só "Lucas", como a pessoa escolheu em Meu perfil */
export function eu(r: Remetente): string {
  const nome = primeiroNome(r.nome || '') || 'eu';
  return r.artigo === 'o' || r.artigo === 'a' ? `${r.artigo} ${nome}` : nome;
}

/**
 * Escolhe uma variação pelo nome do comércio: cada lead recebe um jeito
 * diferente de começar, mas o mesmo lead vê sempre o mesmo texto (não muda
 * a cada vez que a tela abre).
 */
function escolher<T>(semente: string, opcoes: T[]): T {
  let h = 0;
  for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return opcoes[h % opcoes.length];
}

const ABERTURAS = ['Oi, tudo bem?', 'Olá, tudo bem?', 'Oi! Tudo certo por aí?', 'Opa, tudo bem?', 'Oi, como vai?', 'Olá! Tudo tranquilo?'];

/** "4,8 estrelas e 412 avaliações no Google" quando vale a pena citar */
function reputacao(d: DadosMensagem): string | null {
  if (!d.rating || !d.reviews || d.reviews < 20 || d.rating < 4.2) return null;
  return `${d.rating.toFixed(1).replace('.', ',')} estrelas e ${d.reviews} avaliações no Google`;
}

export function mensagemPronta(d: DadosMensagem, r: Remetente): string {
  const quem = eu(r);
  const oferta = d.oferta && d.oferta !== 'sites' ? d.oferta : r.oferta && r.oferta !== 'sites' && !d.oferta ? r.oferta : 'sites';
  const trabalho = oferta === 'outro' ? (r.ofertaTexto ? `trabalho com ${r.ofertaTexto.replace(/^(eu )?(vendo|faço|trabalho com)\s+/i, '').replace(/[.!]+$/, '')}` : '') : TRABALHO[oferta] || TRABALHO.sites;
  const apresentacao = r.empresa
    ? `Aqui é ${quem}, do time ${r.empresa}.`
    : trabalho
      ? `Aqui é ${quem}, ${trabalho}.`
      : `Aqui é ${quem}.`;
  const abertura = escolher(d.nome, ABERTURAS);
  if (oferta !== 'sites') return mensagemDaOferta(oferta, d, `${abertura} ${apresentacao}`, trabalho);
  const rep = reputacao(d);
  const ramo = (d.category || 'o serviço de vocês').toLowerCase();
  const onde = d.city ? ` em ${d.city}` : '';

  let gancho: string;
  switch (d.siteStatus) {
    case 'fora_do_ar':
    case 'nao_encontrado':
      gancho = `Tentei abrir o site da ${d.nome} pelo Google e ele não está carregando. Quem procura vocês por lá acaba indo para o concorrente.`;
      break;
    case 'certificado_vencido':
      gancho = `Entrei no site da ${d.nome} e o navegador mostra um aviso vermelho de "site não seguro" antes de abrir. Isso espanta muita gente.`;
      break;
    case 'em_construcao':
      gancho = `Entrei no site da ${d.nome} e ele está vazio, como se estivesse em construção. Passa a impressão de que vocês fecharam.`;
      break;
    case 'sem_https':
      gancho = `Vi que o site da ${d.nome} aparece como "não seguro" no navegador. Dá para resolver isso e ainda deixar ele mais bonito.`;
      break;
    case 'virou_social':
      gancho = `Vi que o link de site da ${d.nome} no Google leva direto para uma rede social. Um site próprio passa muito mais confiança.`;
      break;
    default:
      if (d.websiteKind === 'social') {
        gancho = `Vi o Instagram da ${d.nome} e o trabalho de vocês é muito bom${rep ? ` (${rep}!)` : ''}. Só que quem procura ${ramo}${onde} no Google não encontra um site de vocês.`;
      } else if (d.websiteKind === 'marketplace') {
        gancho = `Vi que a ${d.nome} atende pelo ${plataforma(d.website)}. Com um site próprio, o cliente fala direto com vocês, sem pagar comissão para ninguém.`;
      } else if (d.websiteKind === 'weak') {
        gancho = `Vi que o site da ${d.nome} está num construtor gratuito. Um site próprio, com o endereço de vocês, passa muito mais confiança.`;
      } else if (d.websiteKind === 'site') {
        // tem site no ar: a ferramenta não mede se é lento ou feio, então o gancho é melhorar, sem acusar
        gancho = escolher(d.nome + 'site', [
          `Dei uma olhada no site da ${d.nome} e acho que dá para deixar ele mais moderno e pensado para o celular, que é onde a maioria procura hoje.`,
          `Vi o site da ${d.nome} e tive umas ideias para ele trazer mais cliente pelo Google e pelo WhatsApp.`,
          `Entrei no site da ${d.nome} e acho que ele pode trabalhar mais a favor de vocês, com um visual mais atual e um jeito rápido de chamar no WhatsApp.`,
        ]);
      } else {
        gancho = `Procurei ${ramo}${onde} no Google e a ${d.nome} aparece${rep ? ` com ${rep.replace(/ no Google$/, '')}` : ''}, mas sem site. Quem pesquisa acaba indo para quem tem.`;
      }
  }

  const fecho = d.previaUrl
    ? `${escolher(d.nome + 'p', ['Fiz uma prévia de como o site de vocês poderia ficar', 'Montei uma prévia de como poderia ficar', 'Fiz um rascunho de como o site de vocês poderia ser'])}: ${d.previaUrl}\n${escolher(d.nome + 'q', ['O que você acha?', 'Me fala o que achou!', 'Faz sentido para vocês?'])}`
    : escolher(d.nome + 'f', [
        'Montei uma ideia rápida de como o site de vocês poderia ficar. Posso te mostrar?',
        'Fiz um rascunho de como poderia ficar. Quer dar uma olhada?',
        'Tenho uma ideia pronta de como ficaria. Posso te mandar?',
      ]);

  return `${abertura} ${apresentacao}\n\n${gancho}\n\n${fecho}`;
}

/** a primeira mensagem para quem não vende site: o gancho é a dor daquela oferta */
function mensagemDaOferta(oferta: string, d: DadosMensagem, inicio: string, trabalho: string): string {
  const rep = reputacao(d);
  const ramo = (d.category || 'o seu ramo').toLowerCase();
  const onde = d.city ? ` em ${d.city}` : '';
  let gancho: string;
  let fecho: string;
  switch (oferta) {
    case 'social':
      gancho = rep
        ? `Vi a ${d.nome} no Google, com ${rep}, e não achei um Instagram de vocês. Muita gente procura no Instagram antes de ir.`
        : `Procurei a ${d.nome} no Instagram e não encontrei um perfil de vocês. Hoje muita gente escolhe onde ir pelo Instagram.`;
      fecho = 'Posso te mandar uma ideia de como seria o perfil de vocês, com os primeiros posts?';
      break;
    case 'trafego':
      gancho = d.semAnuncio
        ? `Entrei no site da ${d.nome} e vi que ele não tem como medir quem chega por anúncio. Dá para trazer mais cliente${onde} gastando pouco, e saber exatamente o que deu retorno.`
        : `A ${d.nome} já tem movimento${rep ? ` (${rep})` : ''}. Com anúncio no Google e no Instagram dá para trazer ainda mais gente que procura ${ramo}${onde}.`;
      fecho = 'Posso te mostrar quanto custaria uma primeira campanha?';
      break;
    case 'design':
      gancho = (d.fotosGoogle ?? 0) < 3
        ? `Vi o perfil da ${d.nome} no Google e ele está quase sem foto. É a primeira coisa que o cliente vê antes de decidir.`
        : `Vi a ${d.nome} no Google e achei que a marca de vocês merece uma identidade à altura do trabalho${rep ? ` (${rep}!)` : ''}.`;
      fecho = 'Posso te mandar umas ideias de logo e de identidade para vocês?';
      break;
    case 'empresas':
      gancho = `Vi a ${d.nome} no Google${rep ? `, com ${rep}` : ''}, e imagino que a rotina de vocês seja corrida.`;
      fecho = `Posso te explicar em 2 minutos como ajudo empresas de ${ramo}${onde}?`;
      break;
    default:
      gancho = `Vi a ${d.nome} no Google${rep ? `, com ${rep}` : ''}, e acho que posso ajudar vocês.`;
      fecho = trabalho ? 'Posso te contar em 2 minutos como funciona?' : 'Posso te mostrar o que eu faço?';
  }
  return `${inicio}\n\n${gancho}\n\n${fecho}`;
}

/** link do WhatsApp com o texto já preenchido */
export function linkComTexto(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// --------------------------------------------------- modelos salvos

/** os marcadores que um modelo pode usar, com o que cada um vira */
export const MARCADORES: { chave: string; rotulo: string }[] = [
  { chave: '{comercio}', rotulo: 'nome do comércio' },
  { chave: '{ramo}', rotulo: 'ramo' },
  { chave: '{cidade}', rotulo: 'cidade' },
  { chave: '{problema}', rotulo: 'o problema do site, em poucas palavras' },
  { chave: '{avaliacoes}', rotulo: 'nota e avaliações no Google' },
  { chave: '{previa}', rotulo: 'link da prévia' },
  { chave: '{meu_nome}', rotulo: 'seu nome' },
  { chave: '{eu}', rotulo: 'seu nome com "o" ou "a" (Meu perfil)' },
  { chave: '{empresa}', rotulo: 'sua empresa' },
];

/** "o site de vocês não está abrindo", "vocês só têm Instagram"... */
export function problemaCurto(d: DadosMensagem): string {
  switch (d.siteStatus) {
    case 'fora_do_ar':
    case 'nao_encontrado':
      return 'o site de vocês não está abrindo';
    case 'certificado_vencido':
      return 'o site de vocês aparece com aviso de "não seguro"';
    case 'em_construcao':
      return 'o site de vocês está vazio, em construção';
    case 'sem_https':
      return 'o site de vocês aparece como "não seguro"';
    case 'virou_social':
      return 'o link de site no Google leva para uma rede social';
  }
  if (d.websiteKind === 'social') return 'vocês só têm rede social, sem site próprio';
  if (d.websiteKind === 'marketplace') return `vocês dependem do ${plataforma(d.website)}`;
  if (d.websiteKind === 'weak') return 'o site de vocês está num construtor gratuito';
  if (d.websiteKind === 'site') return 'o site de vocês pode ficar mais moderno e trazer mais clientes';
  return 'vocês ainda não têm site';
}

function valores(d: DadosMensagem, r: Remetente): Record<string, string> {
  return {
    '{comercio}': d.nome,
    '{ramo}': (d.category || '').toLowerCase(),
    '{cidade}': d.city || '',
    '{problema}': problemaCurto(d),
    '{avaliacoes}': d.rating && d.reviews ? `${d.rating.toFixed(1).replace('.', ',')} estrelas e ${d.reviews} avaliações` : '',
    '{previa}': d.previaUrl || '',
    '{meu_nome}': primeiroNome(r.nome || ''),
    '{eu}': eu(r),
    '{empresa}': r.empresa || '',
  };
}

/** troca os marcadores do modelo pelos dados deste lead */
export function aplicarModelo(modelo: string, d: DadosMensagem, r: Remetente): string {
  let t = modelo;
  for (const [k, v] of Object.entries(valores(d, r))) t = t.split(k).join(v);
  return t.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
}

/**
 * Ao salvar como modelo, o que é deste lead vira marcador sozinho (o nome do
 * comércio vira {comercio}, a cidade {cidade}...), para servir em qualquer
 * outro lead sem a pessoa precisar saber de marcador.
 */
export function virarModelo(texto: string, d: DadosMensagem, r: Remetente): string {
  const v = valores(d, r);
  const trocas = (['{comercio}', '{previa}', '{avaliacoes}', '{problema}', '{empresa}', '{cidade}', '{eu}', '{meu_nome}', '{ramo}'] as const)
    .map((k) => [k, v[k]] as const)
    .filter(([, val]) => val && val.length >= 3)
    .sort((a, b) => b[1].length - a[1].length);
  let t = texto;
  for (const [k, val] of trocas) t = t.split(val).join(k);
  return t;
}
