/**
 * O que o dono ensina ao robô na tela "Treinar o robô" (contas.robo_config):
 * como ele se apresenta, o jeito de escrever, o que a empresa faz e as
 * respostas certas para as perguntas de sempre. Tudo que estiver aqui o
 * robô pode usar; o que não estiver, ele chama o dono. Roda no navegador e
 * no servidor.
 */

export type Formalidade = 'descontraido' | 'equilibrado' | 'formal';
export type Emojis = 'nunca' | 'pouco' | 'avontade';

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

/** uma correção feita no "Testar o robô": o que o cliente disse, o que o robô disse e o que deveria ter dito */
export interface Exemplo {
  cliente: string;
  errado: string;
  certo: string;
}

export interface ConfigRobo {
  /** como assina e se apresenta: "Lucas" */
  nome: string;
  /** a apresentação completa: "Lucas, da equipe da Vertion Stack" */
  apresentacao: string;
  formalidade: Formalidade;
  emojis: Emojis;
  /** pode rir com "kkk" quando o cliente brinca */
  risada: boolean;
  /** pode dividir a resposta em 2 ou 3 balões curtos */
  baloes: boolean;
  /** expressões e jeitos de falar seus */
  expressoes: string;
  /** mensagens que você escreveu, para ele copiar o jeito */
  exemplosDeEscrita: string;
  sobre: string;
  servicos: string;
  prazos: string;
  pagamento: string;
  /** um link por linha; só estes links (além da prévia e da proposta) podem ir para o cliente */
  portfolio: string;
  agenda: string;
  perguntas: Pergunta[];
  proibido: string;
  /** horário em que o robô responde (Brasília) */
  horaInicio: number;
  horaFim: number;
  exemplos: Exemplo[];
}

export const CONFIG_PADRAO: ConfigRobo = {
  nome: 'Lucas',
  apresentacao: 'Lucas, da equipe da Vertion Stack',
  formalidade: 'descontraido',
  emojis: 'pouco',
  risada: true,
  baloes: true,
  expressoes: '',
  exemplosDeEscrita: '',
  sobre: '',
  servicos: '',
  prazos: '',
  pagamento: '',
  portfolio: '',
  agenda: '',
  perguntas: [],
  proibido: '',
  horaInicio: 8,
  horaFim: 21,
  exemplos: [],
};

export const MAX_PERGUNTAS = 30;
export const MAX_EXEMPLOS = 40;

const texto = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const hora = (v: unknown, padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : padrao;
};

/** aceita qualquer coisa (do banco ou do navegador) e devolve uma config válida */
export function normalizarConfig(bruto: unknown): ConfigRobo {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const p = CONFIG_PADRAO;
  const inicio = hora(b.horaInicio, p.horaInicio);
  const fim = hora(b.horaFim, p.horaFim);
  return {
    nome: texto(b.nome ?? p.nome, 40).trim() || p.nome,
    apresentacao: texto(b.apresentacao ?? p.apresentacao, 120).trim() || p.apresentacao,
    formalidade: (['descontraido', 'equilibrado', 'formal'] as const).includes(b.formalidade as Formalidade) ? (b.formalidade as Formalidade) : p.formalidade,
    emojis: (['nunca', 'pouco', 'avontade'] as const).includes(b.emojis as Emojis) ? (b.emojis as Emojis) : p.emojis,
    risada: typeof b.risada === 'boolean' ? b.risada : p.risada,
    baloes: typeof b.baloes === 'boolean' ? b.baloes : p.baloes,
    expressoes: texto(b.expressoes, 800),
    exemplosDeEscrita: texto(b.exemplosDeEscrita, 3000),
    sobre: texto(b.sobre, 2000),
    servicos: texto(b.servicos, 4000),
    prazos: texto(b.prazos, 1500),
    pagamento: texto(b.pagamento, 1000),
    portfolio: texto(b.portfolio, 1500),
    agenda: texto(b.agenda, 600),
    perguntas: (Array.isArray(b.perguntas) ? b.perguntas : [])
      .map((x) => ({ pergunta: texto((x as Pergunta)?.pergunta, 300).trim(), resposta: texto((x as Pergunta)?.resposta, 1200).trim() }))
      .filter((x) => x.pergunta && x.resposta)
      .slice(0, MAX_PERGUNTAS),
    proibido: texto(b.proibido, 1500),
    horaInicio: inicio < fim ? inicio : p.horaInicio,
    horaFim: inicio < fim ? fim : p.horaFim,
    exemplos: (Array.isArray(b.exemplos) ? b.exemplos : [])
      .map((x) => ({ cliente: texto((x as Exemplo)?.cliente, 600).trim(), errado: texto((x as Exemplo)?.errado, 800).trim(), certo: texto((x as Exemplo)?.certo, 800).trim() }))
      .filter((x) => x.certo)
      .slice(-MAX_EXEMPLOS),
  };
}

/** os links do portfólio que o robô pode mandar */
export function linksDoPortfolio(c: ConfigRobo): string[] {
  return c.portfolio.match(/https?:\/\/[^\s)>\]]+/g) || [];
}
