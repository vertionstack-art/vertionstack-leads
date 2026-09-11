/**
 * Link da proposta que o cliente abre.
 *
 * A página é pública por necessidade: o dono da pizzaria não vai criar
 * conta no painel para ler um orçamento. Mas pública não pode significar
 * adivinhável — sem token, trocar o id na barra de endereço daria a lista
 * de propostas de todo mundo. O token é derivado do id com um segredo do
 * servidor, então só quem tem o link chega lá.
 */

import { createHmac } from 'node:crypto';

function segredo(): string {
  return (
    process.env.PROPOSTA_SECRET ||
    process.env.INGEST_TOKEN ||
    process.env.USUARIOS ||
    'vertion-leads-sem-segredo'
  );
}

export function tokenDaProposta(id: string): string {
  return createHmac('sha256', segredo()).update('proposta:' + id).digest('hex').slice(0, 16);
}

export function tokenConfere(id: string, token: string): boolean {
  const esperado = tokenDaProposta(id);
  if (token.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ token.charCodeAt(i);
  return dif === 0;
}

export function caminhoDaProposta(id: string): string {
  return `/p/${encodeURIComponent(id)}/${tokenDaProposta(id)}`;
}
