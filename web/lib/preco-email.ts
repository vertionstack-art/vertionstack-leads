/**
 * O valor do site no e-mail do exterior.
 *
 * O Lucas digita o valor no rascunho e a frase com o preço entra sozinha no
 * texto, logo depois da demo: é ali que o dono, recém-saído do link, se
 * pergunta "e quanto custa?". A IA nunca põe preço por conta própria (as
 * instruções proíbem número fora dos fatos); o valor é sempre o que ele
 * digitou.
 *
 * Usado na tela (enquanto ele digita) e no servidor (quando a IA reescreve
 * o e-mail, a frase volta no mesmo lugar).
 */

export type Moeda = 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AUD' | 'NZD';

export const MOEDAS: { id: Moeda; simbolo: string; rotulo: string }[] = [
  { id: 'USD', simbolo: '$', rotulo: 'US$ (dólar americano)' },
  { id: 'CAD', simbolo: 'CA$', rotulo: 'CA$ (dólar canadense)' },
  { id: 'GBP', simbolo: '£', rotulo: '£ (libra)' },
  { id: 'EUR', simbolo: '€', rotulo: '€ (euro)' },
  { id: 'AUD', simbolo: 'A$', rotulo: 'A$ (dólar australiano)' },
  { id: 'NZD', simbolo: 'NZ$', rotulo: 'NZ$ (dólar neozelandês)' },
];

export function moedaValida(m: unknown): Moeda | null {
  return MOEDAS.some((x) => x.id === m) ? (m as Moeda) : null;
}

/** a moeda de lá, pelo fuso do lead e pela sigla da província canadense na cidade */
export function moedaDoLead(fuso: string, cidade: string | null): Moeda {
  if (fuso === 'Europe/London') return 'GBP';
  if (fuso === 'Europe/Dublin') return 'EUR';
  if (fuso.startsWith('Australia/')) return 'AUD';
  if (fuso === 'Pacific/Auckland') return 'NZD';
  if (/,\s*(ON|BC|AB|QC|NS|NB|MB|SK|PE|NL)\b/i.test(cidade || '') || fuso === 'America/Halifax') return 'CAD';
  return 'USD';
}

/** "1200" ou "1.200,50" ou "1,200" → 1200 / 1200.5; inválido ou zero → null */
export function lerValor(texto: unknown): number | null {
  let t = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  // vírgula seguida de 1 ou 2 dígitos no fim é centavo (jeito brasileiro); o resto é milhar
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
}

export function valorFormatado(valor: number, moeda: Moeda): string {
  const simbolo = MOEDAS.find((m) => m.id === moeda)!.simbolo;
  const numero = valor.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: 2 });
  return simbolo + numero;
}

/** a frase do preço; começa sempre igual, é assim que a ferramenta acha e troca */
export function frasePreco(valor: number, moeda: Moeda): string {
  return `The full site is ${valorFormatado(valor, moeda)}, customized for you from top to bottom.`;
}

// pega também a frase antiga ("The full site, built around your own photos...")
const INICIO = 'The full site';

/**
 * Põe, troca ou tira a frase do preço no texto. Vai num parágrafo próprio
 * logo depois do bloco da demo ([DEMO] e a frase que vem com ele).
 */
export function comPreco(corpo: string, valor: number | null, moeda: Moeda): string {
  const paragrafos = corpo.split(/\n{2,}/).filter((p) => !p.trim().startsWith(INICIO));
  if (valor === null) return paragrafos.join('\n\n');
  const frase = frasePreco(valor, moeda);
  let i = paragrafos.findIndex((p) => p.includes('[DEMO]'));
  if (i === -1) {
    // sem demo no texto: antes da pergunta final e do "Best, Lucas"
    i = Math.max(0, paragrafos.length - 3);
  } else {
    // [DEMO] sozinho no fim do parágrafo: a frase "é um ponto de partida" vem no seguinte
    const depois = paragrafos[i].split('[DEMO]')[1] ?? '';
    if (!depois.trim() && i + 1 < paragrafos.length - 1) i += 1;
  }
  paragrafos.splice(i + 1, 0, frase);
  return paragrafos.join('\n\n');
}
