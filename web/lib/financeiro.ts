/**
 * O Financeiro de quem usa a ferramenta: quantos clientes fechou, quanto isso
 * rendeu de entrada e de mensalidade, o que ainda está na mesa e onde vende
 * melhor. Tudo sai das propostas e dos status que a pessoa já usa no painel —
 * não existe digitação à parte, então o número é sempre o do trabalho real.
 *
 * Fechado = proposta marcada "o cliente fechou" ou lead no status "fechado".
 * O valor sai da proposta salva; lead fechado sem proposta conta como
 * cliente, mas sem valor (e a tela avisa).
 */

import { db, json } from './sql';
import { montarProposta, normalizarMarcacoes } from './proposta';
import type { Formalizacao, Porte } from './catalogo';

export interface ClienteFechado {
  id: string;
  nome: string;
  categoria: string | null;
  cidade: string | null;
  fechadoEm: string;
  entrada: number;
  mensalidade: number;
  semValor: boolean;
}

export interface Financeiro {
  clientes: ClienteFechado[];
  totais: {
    clientes: number;
    clientesMes: number;
    receitaMes: number;
    receitaTotal: number;
    recorrencia: number;
    ticketMedio: number;
    conversao: number | null;
    abertas: number;
    valorNaMesa: number;
    semValor: number;
  };
  funil: { novo: number; contatado: number; negociando: number; fechado: number; descartado: number };
  meses: { mes: string; rotulo: string; clientes: number; receita: number }[];
  porNicho: { nicho: string; clientes: number; receita: number }[];
  meta: number;
}

interface CfgProposta {
  marcacoes?: unknown;
  porte?: Porte;
  formalizacao?: Formalizacao;
  desconto?: number;
  ignorarTeto?: boolean;
  fechado?: boolean;
  fechadoEm?: string;
}

function valores(cfg: CfgProposta | null): { entrada: number; mensalidade: number } | null {
  if (!cfg) return null;
  try {
    const p = montarProposta({
      marcacoes: normalizarMarcacoes(cfg.marcacoes),
      porte: cfg.porte || 'micro',
      formalizacao: cfg.formalizacao || 'desconhecido',
      desconto: cfg.desconto,
      ignorarTeto: cfg.ignorarTeto,
    });
    return { entrada: p.entrada, mensalidade: p.mensalidade };
  } catch {
    return null;
  }
}

/** "2026-10" no horário de Brasília */
function chaveDoMes(d: Date): string {
  const b = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function financeiroDaConta(contaId: string): Promise<Financeiro> {
  const sql = db();
  const [linhas, statusRows, conta] = await Promise.all([
    sql`
      select id, name, category, city, status, proposta, updated_at from leads
      where conta_id = ${contaId} and (proposta is not null or status = 'fechado')
    `,
    sql`select status, count(*)::int as n from leads where conta_id = ${contaId} group by status`,
    sql`select meta_mensal_centavos from contas where id = ${contaId}`,
  ]);

  const funil = { novo: 0, contatado: 0, negociando: 0, fechado: 0, descartado: 0 };
  for (const r of statusRows) if (r.status in funil) funil[r.status as keyof typeof funil] = r.n;

  const agora = new Date();
  const mesAtual = chaveDoMes(agora);
  const clientes: ClienteFechado[] = [];
  let abertas = 0;
  let valorNaMesa = 0;

  for (const l of linhas) {
    const cfg = json<CfgProposta>(l.proposta);
    const v = valores(cfg);
    const fechado = Boolean(cfg?.fechado) || l.status === 'fechado';
    if (fechado) {
      clientes.push({
        id: l.id,
        nome: l.name,
        categoria: l.category,
        cidade: l.city,
        fechadoEm: cfg?.fechadoEm || new Date(l.updated_at).toISOString(),
        entrada: v?.entrada ?? 0,
        mensalidade: v?.mensalidade ?? 0,
        semValor: !v || (v.entrada === 0 && v.mensalidade === 0),
      });
    } else if (v && l.status !== 'descartado' && (v.entrada > 0 || v.mensalidade > 0)) {
      abertas++;
      valorNaMesa += v.entrada;
    }
  }
  clientes.sort((a, b) => b.fechadoEm.localeCompare(a.fechadoEm));

  // seis meses, do mais antigo ao atual
  const meses: Financeiro['meses'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 15));
    const mes = chaveDoMes(d);
    meses.push({ mes, rotulo: MESES[Number(mes.slice(5)) - 1], clientes: 0, receita: 0 });
  }
  const nichos = new Map<string, { clientes: number; receita: number }>();
  for (const c of clientes) {
    const m = meses.find((x) => x.mes === chaveDoMes(new Date(c.fechadoEm)));
    if (m) {
      m.clientes++;
      m.receita += c.entrada;
    }
    const n = (c.categoria || 'Sem categoria').trim();
    const atual = nichos.get(n) || { clientes: 0, receita: 0 };
    nichos.set(n, { clientes: atual.clientes + 1, receita: atual.receita + c.entrada });
  }

  const doMes = clientes.filter((c) => chaveDoMes(new Date(c.fechadoEm)) === mesAtual);
  const comValor = clientes.filter((c) => !c.semValor);
  const receitaTotal = comValor.reduce((s, c) => s + c.entrada, 0);
  // quem já passou do "novo": foi abordado de algum jeito
  const trabalhados = funil.contatado + funil.negociando + funil.fechado + funil.descartado;

  return {
    clientes,
    totais: {
      clientes: clientes.length,
      clientesMes: doMes.length,
      receitaMes: doMes.reduce((s, c) => s + c.entrada, 0),
      receitaTotal,
      recorrencia: clientes.reduce((s, c) => s + c.mensalidade, 0),
      ticketMedio: comValor.length ? receitaTotal / comValor.length : 0,
      conversao: trabalhados ? clientes.length / trabalhados : null,
      abertas,
      valorNaMesa,
      semValor: clientes.length - comValor.length,
    },
    funil,
    meses,
    porNicho: [...nichos.entries()]
      .map(([nicho, x]) => ({ nicho, ...x }))
      .sort((a, b) => b.receita - a.receita || b.clientes - a.clientes)
      .slice(0, 6),
    meta: conta[0]?.meta_mensal_centavos ? conta[0].meta_mensal_centavos / 100 : 0,
  };
}
