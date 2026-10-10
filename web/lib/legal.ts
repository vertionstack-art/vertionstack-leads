/**
 * Quem responde pela ferramenta nos Termos de uso e na Política de
 * privacidade, e a versão em vigor dos dois textos.
 *
 * O nome e o documento vêm da Vercel quando existem (LEGAL_NOME,
 * LEGAL_DOCUMENTO, LEGAL_EMAIL): o CNPJ não é inventado aqui — se a variável
 * não existir, a linha do documento simplesmente não aparece.
 */

/** muda quando os textos mudarem; o cadastro guarda qual versão a pessoa aceitou */
export const VERSAO_TERMOS = '2026-10-10';
export const DATA_TERMOS = '10 de outubro de 2026';

export function responsavel(): { nome: string; documento: string | null; email: string } {
  return {
    nome: process.env.LEGAL_NOME || 'Vertion Stack',
    documento: process.env.LEGAL_DOCUMENTO || null,
    email: process.env.LEGAL_EMAIL || process.env.EMPRESA_EMAIL || 'vertionstack@gmail.com',
  };
}
