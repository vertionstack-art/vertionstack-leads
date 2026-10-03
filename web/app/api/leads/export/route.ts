import { todosOsLeads } from '@/lib/db';
import { sessaoAtual } from '@/lib/conta';
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
  ['responsavel', 'Responsável'],
  ['coletadoPor', 'Coletado por'],
  ['siteStatus', 'Situação real do site'],
  ['notes', 'Anotações'],
  ['searchTerm', 'Termo buscado'],
  ['mapsUrl', 'Link do Maps'],
];

/** Excel brasileiro espera ponto-e-vírgula como separador e BOM no começo. */
function celula(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // nome de comércio começando com "=" viraria fórmula no Excel de quem abre o arquivo
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.bloqueada) {
    return new Response('Não autorizado.', { status: 401 });
  }

  const leads = await todosOsLeads(sessao.contaId, filtrosDaUrl(new URL(req.url)));

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
