/**
 * Busca de leads fora do Brasil.
 *
 * Só países de língua inglesa por enquanto: o e-mail sai em inglês, e é
 * neles que e-mail comercial frio para empresa é permitido com regra clara
 * (opt-out e endereço de quem envia). Alemanha e boa parte da Europa exigem
 * consentimento prévio até entre empresas, por isso ficaram de fora.
 *
 * O nicho vai para o Google em inglês ("barber shop in Austin, TX"): em
 * português o Google de lá devolve meia dúzia de comércios brasileiros.
 */

export interface PaisExterior {
  id: string;
  nome: string;
  /** como aparece no campo da cidade */
  exemploCidade: string;
  exemploBairros: string;
  /** cidades médias: muito comércio local e menos gente oferecendo site que nas capitais */
  cidades: string[];
  /** terminações de domínio comuns no país, para achar site fora do Maps */
  tlds: string[];
}

export const PAISES_EXTERIOR: PaisExterior[] = [
  { id: 'US', nome: 'Estados Unidos', exemploCidade: 'Ex.: Austin, TX', exemploBairros: 'Downtown\nSouth Congress\nEast Austin', cidades: ['Austin, TX', 'Denver, CO', 'Nashville, TN', 'Portland, OR', 'Charlotte, NC', 'Tampa, FL', 'Raleigh, NC', 'Boise, ID'], tlds: ['com', 'us', 'net'] },
  { id: 'CA', nome: 'Canadá', exemploCidade: 'Ex.: Toronto, ON', exemploBairros: 'Downtown\nScarborough\nNorth York', cidades: ['Calgary, AB', 'Ottawa, ON', 'Hamilton, ON', 'Halifax, NS', 'Victoria, BC'], tlds: ['ca', 'com'] },
  { id: 'GB', nome: 'Reino Unido', exemploCidade: 'Ex.: Manchester', exemploBairros: 'City Centre\nSalford\nStockport', cidades: ['Manchester', 'Leeds', 'Bristol', 'Nottingham', 'Sheffield', 'Brighton'], tlds: ['co.uk', 'uk', 'com'] },
  { id: 'IE', nome: 'Irlanda', exemploCidade: 'Ex.: Dublin', exemploBairros: 'Dublin 2\nRathmines\nSwords', cidades: ['Dublin', 'Cork', 'Galway', 'Limerick'], tlds: ['ie', 'com'] },
  { id: 'AU', nome: 'Austrália', exemploCidade: 'Ex.: Brisbane, QLD', exemploBairros: 'Fortitude Valley\nSouth Brisbane\nChermside', cidades: ['Brisbane, QLD', 'Perth, WA', 'Adelaide, SA', 'Gold Coast, QLD', 'Newcastle, NSW'], tlds: ['com.au', 'au', 'com'] },
  { id: 'NZ', nome: 'Nova Zelândia', exemploCidade: 'Ex.: Auckland', exemploBairros: 'Ponsonby\nNewmarket\nTakapuna', cidades: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'], tlds: ['co.nz', 'nz', 'com'] },
];

export function paisExterior(id: unknown): PaisExterior | null {
  return PAISES_EXTERIOR.find((p) => p.id === id) ?? null;
}

/**
 * Nichos com dono que decide sozinho e que vive de cliente local: são os que
 * compram site de freelancer. Advocacia e imobiliária ficaram de fora: lá
 * quase todos já têm site feito por agência.
 */
export const NICHOS_EXTERIOR: { pt: string; en: string }[] = [
  { pt: 'Barbearia', en: 'barber shop' },
  { pt: 'Salão de beleza', en: 'hair salon' },
  { pt: 'Dentista', en: 'dentist' },
  { pt: 'Quiropraxia', en: 'chiropractor' },
  { pt: 'Fisioterapia', en: 'physical therapy clinic' },
  { pt: 'Veterinária', en: 'vet clinic' },
  { pt: 'Autoescola', en: 'driving school' },
  { pt: 'Academia / Personal', en: 'personal trainer gym' },
  { pt: 'Encanador', en: 'plumber' },
  { pt: 'Eletricista', en: 'electrician' },
  { pt: 'Telhados', en: 'roofing contractor' },
  { pt: 'Reformas', en: 'general contractor' },
  { pt: 'Paisagismo', en: 'landscaping' },
  { pt: 'Limpeza', en: 'cleaning service' },
  { pt: 'Banho e tosa', en: 'dog grooming' },
  { pt: 'Oficina mecânica', en: 'auto repair shop' },
  { pt: 'Lava-jato', en: 'car detailing' },
  { pt: 'Restaurante', en: 'restaurant' },
  { pt: 'Cafeteria', en: 'coffee shop' },
  { pt: 'Padaria', en: 'bakery' },
  { pt: 'Tatuagem', en: 'tattoo shop' },
  { pt: 'Estética', en: 'med spa' },
  { pt: 'Fotógrafo de casamento', en: 'wedding photographer' },
  { pt: 'Contabilidade', en: 'accountant' },
];

/** o nome em português de um nicho em inglês, quando ele é da lista */
export function nichoEmPortugues(en: string): string | null {
  return NICHOS_EXTERIOR.find((n) => n.en === en)?.pt ?? null;
}

/** a partir desta nota o site do vizinho serve de comparação no e-mail */
export const NOTA_CONCORRENTE = 8;

/**
 * "Melhor lead" lá fora: negócio que existe de verdade e tem cliente
 * (avaliações), mas não tem site que trabalhe por ele. Quem tem menos de
 * 10 avaliações ou nota baixa quase nunca tem verba nem responde e-mail.
 */
export const MIN_AVALIACOES = 10;
export const MIN_NOTA_GOOGLE = 4;
