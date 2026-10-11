/**
 * "O que você vende?": o serviço de quem usa a ferramenta muda o que é um
 * bom lead, a temperatura e a primeira mensagem.
 *
 * - sites: quem não tem site, só tem rede social, marketplace ou site quebrado;
 * - redes sociais: quem não tem Instagram (o site e o Linktree são lidos para conferir);
 * - tráfego pago: quem tem site sem marca de anúncio (pixel do Meta, tag do Google),
 *   ou não tem site mas já tem movimento para anunciar;
 * - design: perfil do Google com pouca foto, ou sem site/identidade própria;
 * - serviços para empresas: empresa ativa, com clientela formada;
 * - outro: qualquer comércio do público escolhido, ordenado por movimento e reputação.
 *
 * Roda no navegador e no servidor: nada de banco aqui.
 */

export type Oferta = 'sites' | 'social' | 'trafego' | 'design' | 'empresas' | 'outro';

export interface InfoOferta {
  id: Oferta;
  titulo: string;
  descricao: string;
  /** "trabalho com ..." na primeira mensagem */
  trabalho: string;
  /** o que entra como lead, explicado na tela da busca */
  criterio: string;
  /** públicos sugeridos ao escolher a oferta */
  publico: string[];
}

export const OFERTAS: InfoOferta[] = [
  {
    id: 'sites',
    titulo: 'Sites e presença digital',
    descricao: 'Você cria sites, landing pages e lojas virtuais.',
    trabalho: 'criação de sites',
    criterio: 'Entra quem não tem site, só tem rede social ou marketplace, usa construtor grátis ou tem o site fora do ar.',
    publico: ['comercio', 'restaurantes', 'saloes', 'clinicas'],
  },
  {
    id: 'social',
    titulo: 'Gestão de redes sociais',
    descricao: 'Você cuida do Instagram, do conteúdo e da presença social.',
    trabalho: 'gestão de redes sociais',
    criterio: 'Entra quem não tem Instagram: a ferramenta procura no Google, no site e no Linktree de cada comércio.',
    publico: ['restaurantes', 'saloes', 'academias', 'pet'],
  },
  {
    id: 'trafego',
    titulo: 'Tráfego pago e anúncios',
    descricao: 'Você roda Google Ads, Meta Ads e campanhas.',
    trabalho: 'tráfego pago e anúncios',
    criterio: 'Entra quem tem site sem pixel do Meta nem tag do Google (não anuncia, ou anuncia sem medir), e quem não tem site mas já tem movimento.',
    publico: ['clinicas', 'construcao', 'escolas', 'oficinas'],
  },
  {
    id: 'design',
    titulo: 'Design e identidade visual',
    descricao: 'Você faz logo, identidade e material gráfico.',
    trabalho: 'design e identidade visual',
    criterio: 'Entra quem tem perfil do Google com pouca ou nenhuma foto, e quem não tem site nem identidade própria na internet.',
    publico: ['comercio', 'restaurantes', 'saloes', 'pet'],
  },
  {
    id: 'empresas',
    titulo: 'Serviços para empresas',
    descricao: 'Contabilidade, jurídico, RH, seguros, consultoria.',
    trabalho: 'serviços para empresas',
    criterio: 'Entra empresa ativa, com clientela formada (pelo menos 10 avaliações no Google), tenha site ou não.',
    publico: ['comercio', 'clinicas', 'construcao', 'oficinas'],
  },
  {
    id: 'outro',
    titulo: 'Outro',
    descricao: 'Conte em uma frase e a gente monta o resto.',
    trabalho: '',
    criterio: 'Entra qualquer comércio do público que você escolheu, com os de mais movimento e melhor nota primeiro.',
    publico: [],
  },
];

export const infoOferta = (o: string | null | undefined): InfoOferta => OFERTAS.find((x) => x.id === o) || OFERTAS[0];

export interface Publico {
  id: string;
  rotulo: string;
  /** os nichos que a busca procura para esse público */
  nichos: string[];
}

export const PUBLICOS: Publico[] = [
  { id: 'comercio', rotulo: 'Comércio local', nichos: ['Loja de roupas', 'Ótica', 'Papelaria', 'Loja de presentes', 'Mercado'] },
  { id: 'restaurantes', rotulo: 'Restaurantes e lanchonetes', nichos: ['Restaurante', 'Lanchonete', 'Pizzaria', 'Hamburgueria', 'Cafeteria', 'Padaria'] },
  { id: 'saloes', rotulo: 'Salões e estética', nichos: ['Salão de beleza', 'Barbearia', 'Clínica de estética', 'Manicure'] },
  { id: 'clinicas', rotulo: 'Clínicas e consultórios', nichos: ['Clínica', 'Clínica odontológica', 'Fisioterapia', 'Psicólogo', 'Nutricionista'] },
  { id: 'academias', rotulo: 'Academias', nichos: ['Academia', 'Studio de pilates', 'Crossfit', 'Escola de lutas'] },
  { id: 'oficinas', rotulo: 'Oficinas e autopeças', nichos: ['Oficina mecânica', 'Autopeças', 'Auto elétrica', 'Funilaria'] },
  { id: 'pet', rotulo: 'Pet shops', nichos: ['Pet shop', 'Clínica veterinária', 'Banho e tosa'] },
  { id: 'escolas', rotulo: 'Escolas e cursos', nichos: ['Escola particular', 'Curso profissionalizante', 'Escola de idiomas', 'Autoescola'] },
  { id: 'construcao', rotulo: 'Construção e reformas', nichos: ['Material de construção', 'Construtora', 'Marmoraria', 'Vidraçaria', 'Serralheria'] },
];

/** o lead serve para esta oferta? (decidido depois de ler site/Linktree) */
export function servePara(
  oferta: Oferta,
  l: { websiteKind: string; instagram: string | null; reviews: number | null; fotosGoogle: number | null; semAnuncio: boolean | null; isLead: boolean },
): boolean {
  const avaliacoes = l.reviews ?? 0;
  switch (oferta) {
    case 'sites':
      return l.isLead;
    case 'social':
      return !l.instagram;
    case 'trafego':
      return l.websiteKind === 'site' ? l.semAnuncio === true : avaliacoes >= 30;
    case 'design':
      return (l.fotosGoogle ?? 0) < 3 || ['none', 'social', 'weak'].includes(l.websiteKind);
    case 'empresas':
      return avaliacoes >= 10;
    case 'outro':
      return true;
  }
}

/** a marca de quem anuncia, no HTML do site: pixel do Meta, Google Ads/Analytics/Tag Manager */
export const MARCA_DE_ANUNCIO = /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*['"]init|googletagmanager\.com|gtag\(\s*['"]config|googleadservices\.com|google-analytics\.com\/analytics/i;
