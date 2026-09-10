import { todosOsLeads } from '@/lib/db';
import { estaLogado } from '@/lib/auth';
import { filtrosDaUrl } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUNAS: [keyof Awaited<ReturnType<typeof todosOsLeads>>[number], string][] = [
  ['name', 'Nome'],
  ['category', 'Categoria'],
  ['websiteLabel', 'Situação do site'],
  ['website', 'Site'],
  ['phone', 'Telefone'],
  ['address', 'Endereço'],
  ['city', 'Cidade'],
  ['rating', 'Nota'],
  ['reviews', 'Avaliações'],
  ['status', 'Status'],
  ['notes', 'Anotações'],
  ['searchTerm', 'Termo buscado'],
  ['mapsUrl', 'Link do Maps'],
];

/** Excel brasileiro espera ponto-e-vírgula como separador e BOM no começo. */
function celula(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  if (!(await estaLogado())) {
    return new Response('Não autorizado.', { status: 401 });
  }

  const leads = await todosOsLeads(filtrosDaUrl(new URL(req.url)));

  const linhas = [COLUNAS.map((c) => c[1]).join(';')];
  for (const lead of leads) {
    linhas.push(COLUNAS.map(([campo]) => celula(lead[campo])).join(';'));
  }

  const hoje = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + linhas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vertion-leads-${hoje}.csv"`,
    },
  });
}
