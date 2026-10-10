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
}

export interface Remetente {
  /** primeiro nome de quem manda */
  nome: string;
  empresa: string | null;
}

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

/** "4,8 estrelas e 412 avaliações no Google" quando vale a pena citar */
function reputacao(d: DadosMensagem): string | null {
  if (!d.rating || !d.reviews || d.reviews < 20 || d.rating < 4.2) return null;
  return `${d.rating.toFixed(1).replace('.', ',')} estrelas e ${d.reviews} avaliações no Google`;
}

export function mensagemPronta(d: DadosMensagem, r: Remetente): string {
  const eu = primeiroNome(r.nome || '') || 'eu';
  // sem "da"/"do": não dá para saber o gênero do nome da empresa
  const apresentacao = r.empresa ? `Aqui é ${eu}, do time ${r.empresa}.` : `Aqui é ${eu}, trabalho com criação de sites.`;
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
      } else {
        gancho = `Procurei ${ramo}${onde} no Google e a ${d.nome} aparece${rep ? ` com ${rep}` : ''}, mas sem site. Quem pesquisa acaba indo para quem tem.`;
      }
  }

  const fecho = d.previaUrl
    ? `Fiz uma prévia de como o site de vocês poderia ficar: ${d.previaUrl}\nO que você acha?`
    : 'Montei uma ideia rápida de como o site de vocês poderia ficar. Posso te mostrar?';

  return `Oi, tudo bem? ${apresentacao}\n\n${gancho}\n\n${fecho}`;
}

/** link do WhatsApp com o texto já preenchido */
export function linkComTexto(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
