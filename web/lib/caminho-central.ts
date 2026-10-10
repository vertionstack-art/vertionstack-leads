/**
 * O endereço da central de administração.
 *
 * Fica só na variável ADMIN_CAMINHO da Vercel, nunca no código: o repositório
 * é público, e um /admin escrito aqui seria achado por qualquer um. A pasta
 * de verdade (app/central) não abre direto — o proxy devolve "não encontrado"
 * para ela e só leva até lá quem digita o caminho secreto.
 */
export function caminhoCentral(): string | null {
  const c = process.env.ADMIN_CAMINHO || '';
  return /^[A-Za-z0-9_-]{16,80}$/.test(c) ? c : null;
}
