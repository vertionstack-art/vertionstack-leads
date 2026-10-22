import { INTERESSES } from './interesses';

/**
 * A ficha que o cliente preenche sozinho, em duas versões com os mesmos
 * campos: o texto para mandar no WhatsApp e o PDF com campos para digitar
 * (app/api/leads/formulario). As duas voltam para cá: o texto colado é lido
 * por `lerTexto`, os campos do PDF por `lerCamposDoPdf`, e o resultado
 * preenche o cadastro do lead. Roda no navegador e no servidor.
 */

export interface Preenchido {
  tipo: 'comercio' | 'pessoa' | null;
  nome: string;
  empresa: string;
  ramo: string;
  telefone: string;
  email: string;
  cidade: string;
  endereco: string;
  instagram: string;
  site: string;
  outro: string;
  ideia: string;
  reuniao: string;
  interesse: string[];
}

type CampoTexto = Exclude<keyof Preenchido, 'tipo' | 'interesse'>;

/** os campos de texto, na ordem da ficha; `pdf` é o nome do campo dentro do PDF */
export const CAMPOS: { id: CampoTexto; rotulo: string; dica?: string; varias?: boolean }[] = [
  { id: 'nome', rotulo: 'Seu nome' },
  { id: 'empresa', rotulo: 'Nome da empresa', dica: 'se for empresa' },
  { id: 'ramo', rotulo: 'Ramo ou profissão' },
  { id: 'telefone', rotulo: 'WhatsApp' },
  { id: 'email', rotulo: 'E-mail' },
  { id: 'cidade', rotulo: 'Cidade' },
  { id: 'endereco', rotulo: 'Endereço', dica: 'se tiver loja ou escritório' },
  { id: 'instagram', rotulo: 'Instagram' },
  { id: 'site', rotulo: 'Site', dica: 'se já tiver' },
];

export const OPCOES_TIPO = [
  { id: 'comercio' as const, rotulo: 'Empresa / comércio' },
  { id: 'pessoa' as const, rotulo: 'Pessoa física' },
];

/** "Outro" vira um campo de texto, não uma caixinha */
export const OPCOES_INTERESSE = INTERESSES.filter((i) => i.id !== 'outro');

export const ROTULO_OUTRO = 'Outro';
export const ROTULO_IDEIA = 'Conte sua ideia';
export const ROTULO_REUNIAO = 'Melhor dia e horário para conversarmos';

export function vazio(): Preenchido {
  return {
    tipo: null, nome: '', empresa: '', ramo: '', telefone: '', email: '', cidade: '', endereco: '',
    instagram: '', site: '', outro: '', ideia: '', reuniao: '', interesse: [],
  };
}

/* ------------------------------------------------------------ texto do WhatsApp */

export function textoParaWhatsapp(empresa: string | null): string {
  const linhas = [
    `*Ficha de cadastro${empresa ? ` — ${empresa}` : ''}*`,
    'Copie esta mensagem, preencha depois dos dois-pontos e me mande de volta.',
    '',
    '*Você é:* (marque com X)',
    ...OPCOES_TIPO.map((o) => `[ ] ${o.rotulo}`),
    '',
    ...CAMPOS.map((c) => `*${c.rotulo}${c.dica ? ` (${c.dica})` : ''}:* `),
    '',
    '*O que você precisa?* (marque com X, pode ser mais de um)',
    ...OPCOES_INTERESSE.map((o) => `[ ] ${o.rotulo}`),
    `*${ROTULO_OUTRO}:* `,
    '',
    `*${ROTULO_IDEIA}:* `,
    '',
    `*${ROTULO_REUNIAO}:* `,
  ];
  return linhas.join('\n');
}

/* ------------------------------------------------------------ leitura do texto */

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*_~]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** cada rótulo da ficha, já normalizado, com o campo que ele preenche */
const ROTULOS: { chave: string; campo: CampoTexto }[] = [
  ...CAMPOS.map((c) => ({ chave: normalizar(c.rotulo), campo: c.id })),
  { chave: 'email', campo: 'email' },
  { chave: 'telefone', campo: 'telefone' },
  { chave: 'nome', campo: 'nome' },
  { chave: normalizar(ROTULO_OUTRO), campo: 'outro' },
  { chave: normalizar(ROTULO_IDEIA), campo: 'ideia' },
  { chave: 'ideia', campo: 'ideia' },
  { chave: normalizar(ROTULO_REUNIAO), campo: 'reuniao' },
  { chave: 'melhor dia', campo: 'reuniao' },
];
// o rótulo mais comprido primeiro: "nome da empresa" antes de "nome"
ROTULOS.sort((a, b) => b.chave.length - a.chave.length);

const MULTILINHA: CampoTexto[] = ['ideia', 'reuniao'];
const TITULOS = ['voce e', 'o que voce precisa', 'ficha de cadastro', 'copie esta mensagem'];
const MARCAS = /^[xX✓✔✅☑•*+vV]$/;

/** "[x] Landing page", "(X) Landing page", "✅ Landing page" e "[ ] Landing page x" */
function lerCaixinha(linha: string): { marcada: boolean; rotulo: string } | null {
  const t = linha.trim();
  const m = t.match(/^[[(]\s*([^\])]{0,3})\s*[\])]\s*(.+)$/);
  if (m) {
    const marca = m[1].trim();
    let rotulo = m[2].trim();
    let marcada = marca !== '' && MARCAS.test(marca);
    const fim = rotulo.match(/\s+([xX✓✔✅])$/u);
    if (fim) {
      marcada = true;
      rotulo = rotulo.slice(0, fim.index).trim();
    }
    return { marcada, rotulo };
  }
  const emoji = t.match(/^(✅|☑️?|✔️?)\s*(.+)$/u);
  if (emoji) return { marcada: true, rotulo: emoji[2].trim() };
  return null;
}

function aplicarCaixinha(p: Preenchido, rotulo: string) {
  const r = normalizar(rotulo);
  if (r.startsWith('empresa') || r.startsWith('comercio')) p.tipo = 'comercio';
  else if (r.startsWith('pessoa')) p.tipo = 'pessoa';
  else {
    const op = OPCOES_INTERESSE.find((o) => r.startsWith(normalizar(o.rotulo)) || normalizar(o.rotulo).startsWith(r));
    if (op && !p.interesse.includes(op.id)) p.interesse.push(op.id);
  }
}

/** lê a ficha que o cliente devolveu pelo WhatsApp */
export function lerTexto(texto: string): Preenchido {
  const p = vazio();
  let atual: CampoTexto | null = null;

  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = bruta.trim();
    if (!linha) continue;

    const caixa = lerCaixinha(linha);
    if (caixa) {
      atual = null;
      if (caixa.marcada) aplicarCaixinha(p, caixa.rotulo);
      continue;
    }

    const doisPontos = linha.indexOf(':');
    if (doisPontos > 0) {
      // o rótulo pode vir com a dica entre parênteses: "Site (se já tiver):"
      const rotulo = normalizar(linha.slice(0, doisPontos).replace(/\(.*?\)/g, ''));
      const achado = ROTULOS.find((r) => rotulo === r.chave || rotulo.startsWith(r.chave + ' '));
      if (achado) {
        atual = achado.campo;
        const valor = linha.slice(doisPontos + 1).replace(/^\*+\s*/, '').trim();
        if (valor) p[atual] = p[atual] ? `${p[atual]}\n${valor}` : valor;
        continue;
      }
    }

    const n = normalizar(linha);
    if (TITULOS.some((t) => n.startsWith(t))) {
      atual = null;
      continue;
    }

    // resposta na linha de baixo do rótulo, ou o resto de um texto longo
    if (atual && (MULTILINHA.includes(atual) || !p[atual])) {
      p[atual] = p[atual] ? `${p[atual]}\n${linha}` : linha;
    }
  }

  return terminar(p);
}

/* ------------------------------------------------------------ leitura do PDF */

/** nomes dos campos dentro do PDF */
export const NOME_NO_PDF = {
  tipo: (id: string) => `tipo_${id}`,
  interesse: (id: string) => `quer_${id}`,
};

/** os valores dos campos do PDF preenchido (texto ou caixinha marcada) */
export function lerCamposDoPdf(valores: Record<string, string | boolean>): Preenchido {
  const p = vazio();
  for (const c of CAMPOS) p[c.id] = String(valores[c.id] ?? '').trim();
  p.outro = String(valores.outro ?? '').trim();
  p.ideia = String(valores.ideia ?? '').trim();
  p.reuniao = String(valores.reuniao ?? '').trim();
  for (const o of OPCOES_TIPO) if (valores[NOME_NO_PDF.tipo(o.id)] === true) p.tipo = o.id;
  for (const o of OPCOES_INTERESSE) if (valores[NOME_NO_PDF.interesse(o.id)] === true) p.interesse.push(o.id);
  return terminar(p);
}

function terminar(p: Preenchido): Preenchido {
  if (p.outro && !p.interesse.includes('outro')) p.interesse.push('outro');
  // não marcou "você é": com nome de empresa é comércio, sem é pessoa
  if (!p.tipo && (p.nome || p.empresa)) p.tipo = p.empresa ? 'comercio' : 'pessoa';
  return p;
}

/** a pessoa preencheu alguma coisa? */
export function temAlgo(p: Preenchido): boolean {
  return Boolean(p.tipo || p.interesse.length || CAMPOS.some((c) => p[c.id]) || p.ideia || p.reuniao);
}
