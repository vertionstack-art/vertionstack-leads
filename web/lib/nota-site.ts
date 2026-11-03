/**
 * A nota do site (0 a 10) de quem já tem site no ar.
 *
 * "Site no ar" não quer dizer "site bom": tem muito site sem botão de
 * WhatsApp, sem jeito de pedir orçamento, que não se ajusta ao celular. Em
 * vez de descartar todo mundo que tem site, a busca dá uma nota, e quem tira
 * até NOTA_SITE_FRACO vira lead com o motivo ao lado.
 *
 * Tudo o que entra é o que dá para ver no HTML (lib/leitura-site). Não achar
 * um botão no HTML não prova que ele não existe (alguns são montados por
 * JavaScript), então o motivo diz "não achei", nunca "não tem".
 *
 * Velocidade (PageSpeed do Google) ficou de fora por decisão do dono
 * (01/11/2026), e quantas visitas o site tem não entra: esse número só o
 * dono do site vê. Só roda no servidor.
 */

import { analisarHtml, type LeituraSite } from './leitura-site';
import { lerPagina } from './verificar-site';

/** até esta nota, quem tem site entra como lead */
export const NOTA_SITE_FRACO = 6;

export interface ProblemaSite {
  codigo: 'sem_whatsapp' | 'sem_contato_direto' | 'sem_telefone' | 'sem_contato' | 'celular' | 'sem_https' | 'sem_descricao' | 'pouco_conteudo' | 'ano_antigo';
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
  url: string;
  medidoEm: string;
  /** a avaliação escrita pela IA, só quando você pede na ficha */
  ia?: { resumo: string; pontos: string[]; em: string } | null;
}

/** o maior ano depois de "©" ou "copyright" no rodapé; null se não houver */
function anoDoRodape(html: string): number | null {
  const anos = [...html.slice(-60_000).matchAll(/(?:©|&copy;|copyright)[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map((m) =>
    Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0),
  );
  return anos.length ? Math.max(...anos) : null;
}

const arred = (n: number) => Math.round(n * 2) / 2;

/**
 * A conta da nota, separada para dar para testar sem internet. Pesos: o que
 * faz o cliente conseguir chamar vale mais (5 de 10), depois celular e
 * segurança (2,5), depois conteúdo e cuidado (2,5).
 */
export function calcularNota(l: LeituraSite, ano: number | null, anoAtual = new Date().getFullYear(), exterior = false) {
  const problemas: ProblemaSite[] = [];
  let pontos = 0;

  // jeito de chamar: até 5
  if (exterior) {
    // fora do Brasil o WhatsApp não é o canal de todo mundo: vale e-mail clicável ou chat
    if (l.whatsapp || l.email) pontos += 2.5;
    else problemas.push({ codigo: 'sem_contato_direto', texto: 'Sem e-mail clicável nem chat', frase: 'não tem um jeito rápido de mandar mensagem pelo site', curto: 'o site não tem um jeito rápido de mandar mensagem' });
  } else if (l.whatsapp) pontos += 2.5;
  else problemas.push({ codigo: 'sem_whatsapp', texto: 'Não achei botão de WhatsApp', frase: 'não achei um jeito rápido de chamar vocês no WhatsApp', curto: 'o site de vocês não tem um jeito rápido de chamar no WhatsApp' });
  if (l.telefoneClicavel) pontos += 1;
  else problemas.push({ codigo: 'sem_telefone', texto: 'Telefone não é clicável', frase: 'no celular não dá para tocar no telefone e ligar direto', curto: 'no site de vocês não dá para tocar no telefone e ligar direto' });
  if (l.formulario || l.agendamento || l.orcamento) pontos += 1.5;
  else problemas.push({ codigo: 'sem_contato', texto: 'Sem formulário, agendamento ou pedido de orçamento', frase: 'não tem como pedir orçamento ou agendar pelo site', curto: 'o site de vocês não tem como pedir orçamento ou agendar' });

  // celular: 1,5
  if (l.celular) pontos += 1.5;
  else problemas.push({ codigo: 'celular', texto: 'Não se ajusta à tela do celular', frase: 'ele não se ajusta direito na tela do celular', curto: 'o site de vocês não se ajusta direito no celular' });

  // cadeado: 1
  if (l.url.startsWith('https://')) pontos += 1;
  else problemas.push({ codigo: 'sem_https', texto: 'Sem cadeado (HTTPS)', frase: 'o navegador mostra o site como "não seguro"', curto: 'o site de vocês aparece como "não seguro"' });

  // conteúdo: 2
  if (l.titulo && l.descricao) pontos += 1;
  else problemas.push({ codigo: 'sem_descricao', texto: 'Sem descrição para o Google', frase: 'no Google ele aparece sem uma descrição do que vocês fazem', curto: 'o site de vocês aparece no Google sem descrição' });
  if (l.texto >= 600 || l.assuntos.length >= 3) pontos += 1;
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
 * Lê o site e dá a nota. Devolve null quando o site não abre para leitura:
 * sem ler, não há nota (e o comércio fica de fora, como antes).
 */
export async function avaliarSite(url: string, limiteMs = 8000, exterior = false): Promise<AvaliacaoSite | null> {
  const alvo = url.startsWith('http') ? url : 'https://' + url;
  const pagina = await lerPagina(alvo, limiteMs).catch(() => null);
  if (!pagina?.html) return null;
  const leitura = analisarHtml(pagina.url || alvo, pagina.html);
  const { nota, problemas } = calcularNota(leitura, anoDoRodape(pagina.html), undefined, exterior);
  return { nota, problemas, url: pagina.url || alvo, medidoEm: new Date().toISOString() };
}

/** "4,5" */
export function notaEmTexto(n: number): string {
  return String(n).replace('.', ',');
}
