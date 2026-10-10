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
  const trocas = (['{comercio}', '{previa}', '{avaliacoes}', '{problema}', '{empresa}', '{cidade}', '{meu_nome}', '{ramo}'] as const)
    .map((k) => [k, v[k]] as const)
    .filter(([, val]) => val && val.length >= 3)
    .sort((a, b) => b[1].length - a[1].length);
  let t = texto;
  for (const [k, val] of trocas) t = t.split(val).join(k);
  return t;
}
