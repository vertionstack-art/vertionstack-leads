/**
 * Link da proposta que o cliente abre.
 *
 * A página é pública por necessidade: o dono da pizzaria não vai criar
 * conta no painel para ler um orçamento. Mas pública não pode significar
 * adivinhável — sem token, trocar o id na barra de endereço daria a lista
 * de propostas de todo mundo. O token é derivado da conta e do id com um
 * segredo do servidor, então só quem tem o link chega lá, e trocar a conta
 * no endereço invalida o token.
 *
 * Formato novo: /p/<conta>~<lead>/<token>
 * Formato antigo (antes das contas): /p/<lead>/<token> — continua abrindo,
 * procurado na conta legada, porque esses links já estão com clientes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

function segredo(): string {
  return (
    process.env.PROPOSTA_SECRET ||
    process.env.INGEST_TOKEN ||
    process.env.USUARIOS ||
    'vertion-leads-sem-segredo'
  );
}

function assinar(texto: string): string {
  return createHmac('sha256', segredo()).update(texto).digest('hex').slice(0, 16);
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function caminhoDaProposta(conta: string, id: string): string {
  return `/p/${conta}~${encodeURIComponent(id)}/${assinar(`proposta:${conta}:${id}`)}`;
}

/**
 * Lê o segmento do endereço e confere o token. Devolve a conta e o id, ou
 * `{ legado: true }` quando é um link do formato antigo (a conta é a legada).
 */
export function lerCaminho(
  segmento: string,
  token: string,
): { conta: string; id: string } | { legado: true; id: string } | null {
  const bruto = decodeURIComponent(segmento);
  const corte = bruto.indexOf('~');
  const conta = corte > 0 ? bruto.slice(0, corte) : '';
  if (/^[0-9a-f-]{36}$/i.test(conta)) {
    const id = bruto.slice(corte + 1);
    return iguais(assinar(`proposta:${conta}:${id}`), token) ? { conta, id } : null;
  }
  return iguais(assinar('proposta:' + bruto), token) ? { legado: true, id: bruto } : null;
}
