/**
 * A nota do site (0 a 10) de quem já tem site no ar.
 *
 * "Site no ar" não quer dizer "site bom": tem muito site lento, sem botão de
 * WhatsApp, que não se ajusta ao celular. Em vez de descartar todo mundo que
 * tem site, a busca dá uma nota, e quem tira até NOTA_SITE_FRACO vira lead
 * com o motivo ao lado.
 *
 * Tudo medido, nada estimado:
 * - velocidade no celular: PageSpeed Insights, a ferramenta grátis do Google
 *   (vale 4 pontos; sem medição, conta 2 e a nota avisa);
 * - o resto: o que dá para ver no HTML (lib/leitura-site). Não achar um botão
 *   no HTML não prova que ele não existe (alguns são montados por
 *   JavaScript), então o motivo diz "não achei", nunca "não tem".
 *
 * Quantas visitas o site tem não entra: esse número só o dono do site vê.
 * Só roda no servidor.
 */

import { analisarHtml, type LeituraSite } from './leitura-site';
import { lerPagina } from './verificar-site';

/** até esta nota, quem tem site entra como lead */
export const NOTA_SITE_FRACO = 6;

export interface ProblemaSite {
  codigo: 'lento' | 'sem_whatsapp' | 'sem_telefone' | 'sem_contato' | 'celular' | 'sem_descricao' | 'pouco_conteudo' | 'ano_antigo';
  /** como aparece na ficha */
  texto: string;
  /** como entra numa mensagem para o dono, sem acusar ("reparei que ...") */
  frase: string;
  /** para o marcador {problema} ("Vi que ...") */
  curto: string;
}

export interface AvaliacaoSite {
  nota: number;
  problemas: ProblemaSite[];
  /** nota de desempenho no celular do PageSpeed (0 a 100); null quando não deu para medir */
  velocidade: number | null;
  /** segundos até o conteúdo principal aparecer no celular (LCP) */
  carregaEmS: number | null;
  url: string;
  medidoEm: string;
  /** a avaliação escrita pela IA, só quando você pede na ficha */
  ia?: { resumo: string; pontos: string[]; em: string } | null;
}

interface PageSpeed {
  velocidade: number;
  carregaEmS: number | null;
}

/**
 * PageSpeed Insights no modo celular. A chave é opcional: sem ela o Google
 * deixa poucas medições por dia; com PAGESPEED_API_KEY (Google Cloud, grátis)
 * o limite diário é alto.
 */
async function medirVelocidade(url: string, limiteMs: number): Promise<PageSpeed | null> {
  const chave = (process.env.PAGESPEED_API_KEY || '').trim();
  const q = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
  if (chave) q.set('key', chave);
  try {
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {
      signal: AbortSignal.timeout(limiteMs),
      cache: 'no-store',
    });
    if (!r.ok) {
      if (r.status !== 400) console.error('[pagespeed]', r.status);
      return null;
    }
    const j = (await r.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> };
    };
    const score = j.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== 'number') return null;
    const lcp = j.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
    return { velocidade: Math.round(score * 100), carregaEmS: typeof lcp === 'number' ? Math.round(lcp / 100) / 10 : null };
  } catch {
    return null;
  }
}

/** o maior ano depois de "©" ou "copyright" no rodapé; null se não houver */
function anoDoRodape(html: string): number | null {
  const anos = [...html.slice(-60_000).matchAll(/(?:©|&copy;|copyright)[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map((m) =>
    Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0),
  );
  return anos.length ? Math.max(...anos) : null;
}

const arred = (n: number) => Math.round(n * 2) / 2;

/** a conta da nota, separada para dar para testar sem internet */
export function calcularNota(l: LeituraSite, ps: PageSpeed | null, ano: number | null, anoAtual = new Date().getFullYear()) {
  const problemas: ProblemaSite[] = [];
  let pontos = 0;

  // velocidade no celular: até 4
  if (ps) {
    pontos += (ps.velocidade / 100) * 4;
    if (ps.velocidade < 50) {
      problemas.push({
        codigo: 'lento',
        texto: `Lento no celular (nota ${ps.velocidade} de 100 no teste do Google${ps.carregaEmS ? `, ${String(ps.carregaEmS).replace('.', ',')} s para aparecer` : ''})`,
        frase: 'ele demora para abrir no celular',
        curto: 'o site de vocês demora para abrir no celular',
      });
    }
  } else {
    pontos += 2;
  }

  // jeito de chamar: até 3
  if (l.whatsapp) pontos += 1.5;
  else problemas.push({ codigo: 'sem_whatsapp', texto: 'Não achei botão de WhatsApp', frase: 'não achei um jeito rápido de chamar vocês no WhatsApp', curto: 'o site de vocês não tem um jeito rápido de chamar no WhatsApp' });
  if (l.telefoneClicavel) pontos += 0.5;
  else problemas.push({ codigo: 'sem_telefone', texto: 'Telefone não é clicável', frase: 'no celular não dá para tocar no telefone e ligar direto', curto: 'no site de vocês não dá para tocar no telefone e ligar direto' });
  if (l.formulario || l.agendamento || l.orcamento) pontos += 1;
  else problemas.push({ codigo: 'sem_contato', texto: 'Sem formulário, agendamento ou pedido de orçamento', frase: 'não tem como pedir orçamento ou agendar pelo site', curto: 'o site de vocês não tem como pedir orçamento ou agendar' });

  // celular: 1
  if (l.celular) pontos += 1;
  else problemas.push({ codigo: 'celular', texto: 'Não se ajusta à tela do celular', frase: 'ele não se ajusta direito na tela do celular', curto: 'o site de vocês não se ajusta direito no celular' });

  // cadeado: 0,5
  if (l.url.startsWith('https://')) pontos += 0.5;

  // conteúdo: 1
  if (l.titulo && l.descricao) pontos += 0.5;
  else problemas.push({ codigo: 'sem_descricao', texto: 'Sem descrição para o Google', frase: 'no Google ele aparece sem uma descrição do que vocês fazem', curto: 'o site de vocês aparece no Google sem descrição' });
  if (l.texto >= 600 || l.assuntos.length >= 3) pontos += 0.5;
  else problemas.push({ codigo: 'pouco_conteudo', texto: 'Pouco conteúdo na página', frase: 'ele tem pouca informação sobre os serviços', curto: 'o site de vocês tem pouca informação sobre os serviços' });

  // atualizado: 0,5
  if (ano !== null && ano < anoAtual - 2) {
    problemas.push({ codigo: 'ano_antigo', texto: `Rodapé com ano antigo (${ano})`, frase: `o rodapé ainda mostra ${ano}, o que passa impressão de site parado`, curto: 'o rodapé do site de vocês ainda mostra um ano antigo' });
  } else {
    pontos += 0.5;
  }

  return { nota: Math.min(10, Math.max(0, arred(pontos))), problemas };
}

/**
 * Lê o site e mede a velocidade ao mesmo tempo. Devolve null quando o site
 * não abre para leitura: sem ler, não há nota (e o comércio fica de fora,
 * como antes).
 */
export async function avaliarSite(url: string, limiteMs = 20_000): Promise<AvaliacaoSite | null> {
  const alvo = url.startsWith('http') ? url : 'https://' + url;
  const [pagina, ps] = await Promise.all([lerPagina(alvo, 8000).catch(() => null), medirVelocidade(alvo, limiteMs)]);
  if (!pagina?.html) return null;
  const leitura = analisarHtml(pagina.url || alvo, pagina.html);
  const { nota, problemas } = calcularNota(leitura, ps, anoDoRodape(pagina.html));
  return {
    nota,
    problemas,
    velocidade: ps?.velocidade ?? null,
    carregaEmS: ps?.carregaEmS ?? null,
    url: pagina.url || alvo,
    medidoEm: new Date().toISOString(),
  };
}

/** "4,5" */
export function notaEmTexto(n: number): string {
  return String(n).replace('.', ',');
}
