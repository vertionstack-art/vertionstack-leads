/**
 * Descobre se um lead é de fora do Brasil, e em que idioma falar com ele.
 *
 * Existe porque a abordagem muda de canal: no Brasil o contato é WhatsApp,
 * fora daqui é e-mail — e e-mail frio escrito em português para um dono de
 * barbearia no Texas vai para o lixo antes da primeira linha.
 *
 * A regra é deliberadamente assimétrica: só marca como estrangeiro quem
 * tem prova de sê-lo. Lead brasileiro sem coordenada e sem telefone
 * continua sendo brasileiro. Errar para o lado do Brasil só custa um
 * botão a menos na tela; errar para o outro lado manda e-mail em inglês
 * para um comerciante de Gurupi.
 */

import type { Lead } from './db';

/**
 * Contorno simplificado do Brasil, em pares [longitude, latitude].
 *
 * Começou como um retângulo e não serviu: o retângulo que cabe o Acre a
 * oeste e o Chuí ao sul engole Santiago, La Paz, Assunção e Bogotá, e
 * todo lead do Chile virava brasileiro. O Brasil é largo em cima e
 * estreito embaixo — a fronteira oeste sai de -74 na altura do Acre e
 * recua para -57 na altura do Rio Grande do Sul. Só um polígono pega isso.
 *
 * Os vértices têm folga para fora de propósito. Os dois erros não custam
 * o mesmo: vizinho contado como brasileiro apenas deixa de ganhar o botão,
 * enquanto brasileiro contado como estrangeiro gera e-mail em espanhol
 * para Recife. Na dúvida, o ponto é do Brasil.
 */
const CONTORNO_BRASIL: [number, number][] = [
  [-74.5, -7.3], // extremo oeste, no Acre
  [-73.5, -9.0],
  [-65.8, -11.0], // Rondônia
  [-60.5, -16.5], // fronteira com a Bolívia
  [-58.5, -20.0],
  [-58.5, -22.0], // Mato Grosso do Sul, junto ao Paraguai
  [-54.8, -25.4], // Foz do Iguaçu
  [-55.0, -27.0],
  [-58.0, -30.5], // fronteira com a Argentina
  [-57.0, -32.5], // fronteira oeste com o Uruguai
  [-53.6, -33.9], // Chuí, extremo sul
  [-51.0, -31.5], // litoral gaúcho, ao sul da lagoa dos Patos
  [-49.5, -30.0],
  [-48.3, -28.8],
  [-48.0, -26.5], // Santa Catarina
  [-44.5, -23.8], // Rio de Janeiro e São Paulo
  [-40.8, -21.5],
  [-39.5, -18.5], // Espírito Santo
  [-38.8, -16.0], // sul da Bahia
  [-37.9, -13.2], // Salvador
  [-36.9, -11.2], // Aracaju
  [-35.5, -9.9], // Maceió
  [-34.6, -8.5], // Recife
  [-34.6, -7.0], // João Pessoa, extremo leste
  [-35.0, -5.0], // Natal
  [-38.0, -3.5], // Fortaleza
  [-41.0, -2.5], // litoral do Piauí e do Ceará
  [-44.0, -2.0], // Maranhão
  [-48.5, -0.5], // Belém
  [-51.0, 4.8], // Oiapoque, extremo norte
  [-56.0, 2.5], // divisa com as Guianas
  [-60.0, 5.5], // Roraima, extremo norte
  [-64.0, 4.5],
  [-67.0, 2.5], // Venezuela
  [-69.8, 1.5], // Colômbia
  [-70.0, -4.5], // tríplice fronteira com Peru e Colômbia
];

/**
 * Caixa da América do Sul de língua espanhola.
 *
 * Só é consultada depois que o ponto já saiu do contorno do Brasil, então
 * não precisa desviar dele. Corta em lat 12,5 — norte da Colômbia e da
 * Venezuela — para não alcançar o Caribe nem a América Central, onde o
 * retângulo chegaria perto demais dos Estados Unidos. México fica de
 * fora por isso: lá o espanhol é reconhecido pelo telefone (+52), porque
 * nenhum retângulo separa Tijuana de San Diego.
 */
const CAIXA_HISPANO_SUL = { latMin: -56, latMax: 12.5, lngMin: -82, lngMax: -34 };

/** Idiomas que o e-mail pode assumir. */
export type Idioma = 'en' | 'es' | 'pt-PT' | 'fr' | 'de' | 'it' | 'nl';

interface Pais {
  nome: string;
  idioma: Idioma;
  /** como o nome do idioma deve ser dito dentro do prompt, em inglês */
  idiomaEmIngles: string;
}

/**
 * Código telefônico internacional → país.
 *
 * Só os destinos que fazem sentido prospectar. O código +1 cobre Estados
 * Unidos e Canadá juntos, e não dá para separar pelo número — fica como
 * "United States or Canada", que é o bastante para o e-mail.
 */
const POR_DDI: Record<string, Pais> = {
  '1': { nome: 'United States or Canada', idioma: 'en', idiomaEmIngles: 'English' },
  '44': { nome: 'United Kingdom', idioma: 'en', idiomaEmIngles: 'British English' },
  '353': { nome: 'Ireland', idioma: 'en', idiomaEmIngles: 'English' },
  '61': { nome: 'Australia', idioma: 'en', idiomaEmIngles: 'Australian English' },
  '64': { nome: 'New Zealand', idioma: 'en', idiomaEmIngles: 'English' },
  '27': { nome: 'South Africa', idioma: 'en', idiomaEmIngles: 'English' },
  '351': { nome: 'Portugal', idioma: 'pt-PT', idiomaEmIngles: 'European Portuguese' },
  '34': { nome: 'Spain', idioma: 'es', idiomaEmIngles: 'Spanish' },
  '52': { nome: 'Mexico', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '54': { nome: 'Argentina', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '56': { nome: 'Chile', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '57': { nome: 'Colombia', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '598': { nome: 'Uruguay', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '595': { nome: 'Paraguay', idioma: 'es', idiomaEmIngles: 'Latin American Spanish' },
  '33': { nome: 'France', idioma: 'fr', idiomaEmIngles: 'French' },
  '49': { nome: 'Germany', idioma: 'de', idiomaEmIngles: 'German' },
  '43': { nome: 'Austria', idioma: 'de', idiomaEmIngles: 'German' },
  '39': { nome: 'Italy', idioma: 'it', idiomaEmIngles: 'Italian' },
  '31': { nome: 'Netherlands', idioma: 'nl', idiomaEmIngles: 'Dutch' },
  '32': { nome: 'Belgium', idioma: 'nl', idiomaEmIngles: 'Dutch' },
  '41': { nome: 'Switzerland', idioma: 'de', idiomaEmIngles: 'German' },
};

/** os códigos mais longos primeiro, senão "1" engole "351" */
const DDIS = Object.keys(POR_DDI).sort((a, b) => b.length - a.length);

export interface Origem {
  /** true quando há prova de que o comércio não fica no Brasil */
  estrangeiro: boolean;
  /** país reconhecido pelo telefone; null quando só a coordenada denunciou */
  pais: string | null;
  idioma: Idioma;
  idiomaEmIngles: string;
  /** o que fez a ferramenta concluir isso — aparece na tela para você conferir */
  motivo: string;
}

const BRASIL: Origem = {
  estrangeiro: false,
  pais: 'Brasil',
  idioma: 'pt-PT',
  idiomaEmIngles: 'Brazilian Portuguese',
  motivo: 'No Brasil',
};

/**
 * Ponto dentro do polígono, pelo método do raio.
 *
 * Traça uma linha horizontal do ponto para o infinito e conta quantas
 * arestas ela cruza: número ímpar significa que o ponto está dentro.
 */
function dentroDoPoligono(lat: number, lng: number, poligono: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/**
 * Lê o telefone e devolve o país, quando o número traz código internacional.
 *
 * Só um número escrito com "+" serve. Telefone americano digitado como
 * (305) 555-0142 é indistinguível de um brasileiro sem DDI, e chutar ali
 * seria pior que não responder.
 */
function paisPeloTelefone(telefone: string | null): Pais | null {
  if (!telefone) return null;
  const t = telefone.trim();
  if (!t.startsWith('+')) return null;

  const digitos = t.replace(/\D/g, '');
  if (digitos.startsWith('55')) return null; // Brasil

  for (const ddi of DDIS) {
    if (digitos.startsWith(ddi)) return POR_DDI[ddi];
  }
  return null;
}

/** true quando a coordenada cai fora do contorno do Brasil */
function foraDoBrasil(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (lat === 0 && lng === 0) return false; // coordenada nula não é prova de nada
  return !dentroDoPoligono(lat, lng, CONTORNO_BRASIL);
}

function ehHispanoSulAmericano(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  const c = CAIXA_HISPANO_SUL;
  return lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax;
}

export function origemDoLead(lead: Pick<Lead, 'phone' | 'lat' | 'lng'>): Origem {
  const porTelefone = paisPeloTelefone(lead.phone);

  // o telefone vale mais que a coordenada: diz o país, não só que é fora
  if (porTelefone) {
    return {
      estrangeiro: true,
      pais: porTelefone.nome,
      idioma: porTelefone.idioma,
      idiomaEmIngles: porTelefone.idiomaEmIngles,
      motivo: `Telefone com código de ${porTelefone.nome}`,
    };
  }

  if (foraDoBrasil(lead.lat, lead.lng)) {
    const hispano = ehHispanoSulAmericano(lead.lat, lead.lng);
    return {
      estrangeiro: true,
      pais: hispano ? 'a Spanish-speaking country in South America' : null,
      idioma: hispano ? 'es' : 'en',
      idiomaEmIngles: hispano ? 'Latin American Spanish' : 'English',
      motivo: hispano ? 'Coordenada na América do Sul de língua espanhola' : 'Coordenada fora do Brasil',
    };
  }

  return BRASIL;
}

/** atalho para a tela, que só precisa da resposta de sim ou não */
export function ehEstrangeiro(lead: Pick<Lead, 'phone' | 'lat' | 'lng'>): boolean {
  return origemDoLead(lead).estrangeiro;
}
