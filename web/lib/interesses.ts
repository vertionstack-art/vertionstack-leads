/**
 * O que o lead quer, marcado no cadastro (pode ser mais de um). Roda no
 * navegador e no servidor.
 */

export interface Interesse {
  id: string;
  rotulo: string;
}

export const INTERESSES: Interesse[] = [
  { id: 'site', rotulo: 'Site institucional' },
  { id: 'landing', rotulo: 'Landing page' },
  { id: 'loja', rotulo: 'Loja virtual' },
  { id: 'sistema', rotulo: 'Sistema / plataforma' },
  { id: 'automacao', rotulo: 'Automação' },
  { id: 'app', rotulo: 'Aplicativo' },
  { id: 'chatbot', rotulo: 'Chatbot / atendimento' },
  { id: 'identidade', rotulo: 'Logo e identidade visual' },
  { id: 'redes', rotulo: 'Redes sociais' },
  { id: 'trafego', rotulo: 'Tráfego pago' },
  { id: 'google', rotulo: 'Perfil no Google' },
  { id: 'outro', rotulo: 'Outro' },
];

export function rotuloDoInteresse(id: string): string {
  return INTERESSES.find((i) => i.id === id)?.rotulo || id;
}

/** só ids conhecidos, sem repetir */
export function interessesValidos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(String).filter((x) => INTERESSES.some((i) => i.id === x)))];
}
