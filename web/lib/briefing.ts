/**
 * O que você sabe sobre o comércio e o Google Maps não conta.
 *
 * A prévia é a peça que fecha a venda, e o que separa uma página genérica
 * de uma que parece feita para aquele negócio não está em nenhum banco de
 * dados: é a cor que ele usa na fachada, o serviço que puxa o faturamento,
 * o "somos os únicos da cidade que fazem X". Isso se digita uma vez, fica
 * guardado no lead, e entra no prompt toda vez.
 *
 * Todos os campos são opcionais de propósito. Preencher três já melhora
 * muito o resultado, e exigir dez faria ninguém preencher nenhum.
 */

export type Estilo =
  | ''
  | 'moderno'
  | 'elegante'
  | 'aconchegante'
  | 'forte'
  | 'minimalista'
  | 'divertido';

export const ESTILOS: { valor: Estilo; rotulo: string; dica: string }[] = [
  { valor: 'moderno', rotulo: 'Moderno e limpo', dica: 'Muito espaço em branco, tipografia grande, poucos elementos.' },
  { valor: 'elegante', rotulo: 'Elegante e sóbrio', dica: 'Tons escuros ou neutros, serifada, ar de caro. Clínica, joalheria, advocacia.' },
  { valor: 'aconchegante', rotulo: 'Aconchegante', dica: 'Tons quentes, foto de gente, ar de casa. Padaria, café, pousada.' },
  { valor: 'forte', rotulo: 'Forte e chamativo', dica: 'Cores saturadas, contraste alto, preço em destaque. Hamburgueria, academia, promoção.' },
  { valor: 'minimalista', rotulo: 'Minimalista', dica: 'Preto e branco, quase nada além do essencial.' },
  { valor: 'divertido', rotulo: 'Divertido', dica: 'Cores vivas, formas soltas, linguagem leve. Pet shop, festa infantil, sorveteria.' },
];

export interface Briefing {
  estilo: Estilo;
  /** como o dono descreve as cores dele: "vermelho e preto", "verde da fachada" */
  cores: string;
  /** a coisa que ele quer que apareça primeiro */
  destaque: string;
  /** serviços ou produtos reais, um por linha */
  servicos: string;
  /** tempo de mercado, prêmios, o que só ele tem */
  diferenciais: string;
  /** o que não pode aparecer: concorrente, cor, assunto */
  evitar: string;
  /** endereços de sites ou imagens que servem de referência visual */
  referencias: string[];
  /** qualquer coisa que não coube nos outros campos */
  observacoes: string;
  /** true quando as imagens vão ser anexadas direto no Claude */
  anexaImagens: boolean;
}

export const BRIEFING_VAZIO: Briefing = {
  estilo: '',
  cores: '',
  destaque: '',
  servicos: '',
  diferenciais: '',
  evitar: '',
  referencias: [],
  observacoes: '',
  anexaImagens: false,
};

/**
 * Lê o que veio do banco sem confiar no formato.
 *
 * O campo é jsonb e pode ter sido gravado por uma versão anterior, ou
 * estar pela metade. Vale mais normalizar aqui do que espalhar `?.` por
 * toda a tela e pelo prompt.
 */
export function lerBriefing(cru: unknown): Briefing {
  if (!cru || typeof cru !== 'object') return { ...BRIEFING_VAZIO };
  const b = cru as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');

  return {
    estilo: (ESTILOS.some((e) => e.valor === b.estilo) ? b.estilo : '') as Estilo,
    cores: texto(b.cores),
    destaque: texto(b.destaque),
    servicos: texto(b.servicos),
    diferenciais: texto(b.diferenciais),
    evitar: texto(b.evitar),
    referencias: Array.isArray(b.referencias)
      ? b.referencias.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : [],
    observacoes: texto(b.observacoes),
    anexaImagens: b.anexaImagens === true,
  };
}

/** quantos campos foram preenchidos — a tela mostra isso para dar noção de progresso */
export function preenchidos(b: Briefing): number {
  let n = 0;
  if (b.estilo) n++;
  for (const campo of [b.cores, b.destaque, b.servicos, b.diferenciais, b.evitar, b.observacoes]) {
    if (campo.trim()) n++;
  }
  if (b.referencias.length) n++;
  return n;
}

export const TOTAL_DE_CAMPOS = 8;

/**
 * Vira o pedaço do prompt que descreve o que o cliente quer.
 *
 * Devolve string vazia quando nada foi preenchido, para o prompt não
 * ganhar uma seção com título e nenhum conteúdo — que só ensina o
 * assistente a ignorar seções vazias.
 */
export function briefingParaPrompt(b: Briefing): string {
  const partes: string[] = [];

  if (b.estilo) {
    const e = ESTILOS.find((x) => x.valor === b.estilo);
    if (e) partes.push(`- **Direção visual pedida:** ${e.rotulo.toLowerCase()} — ${e.dica}`);
  }
  if (b.cores.trim()) partes.push(`- **Cores da marca:** ${b.cores.trim()}`);
  if (b.destaque.trim()) partes.push(`- **O que precisa aparecer primeiro:** ${b.destaque.trim()}`);

  if (b.servicos.trim()) {
    const lista = b.servicos
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `  - ${l}`)
      .join('\n');
    partes.push(`- **Serviços e produtos reais** (use estes, não invente outros):\n${lista}`);
  }

  if (b.diferenciais.trim()) partes.push(`- **Diferenciais:** ${b.diferenciais.trim()}`);
  if (b.evitar.trim()) partes.push(`- **NÃO fazer:** ${b.evitar.trim()}`);

  if (b.referencias.length) {
    const links = b.referencias.map((r) => `  - ${r}`).join('\n');
    partes.push(
      `- **Referências visuais que eu gosto** (abra e observe a direção, sem copiar):\n${links}`,
    );
  }

  if (b.observacoes.trim()) partes.push(`- **Outras observações:** ${b.observacoes.trim()}`);

  if (b.anexaImagens) {
    partes.push(
      '- **Anexei imagens de referência nesta conversa.** Olhe antes de decidir qualquer coisa ' +
        'de visual, e me diga em uma linha o que você tirou delas.',
    );
  }

  return partes.join('\n');
}
