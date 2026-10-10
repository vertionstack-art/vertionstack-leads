/**
 * Abre o site do comércio e diz se ele realmente está de pé.
 *
 * O Google só informa qual endereço o comércio cadastrou — não se aquele
 * endereço ainda funciona. Na prática muita coisa cadastrada está fora do
 * ar, com domínio vencido, parada em "em construção" ou redirecionando
 * para o Instagram. Todos esses aparecem como "tem site" e seriam
 * descartados, quando na verdade são os leads mais fáceis de abordar.
 *
 * Nada disso custa nada: é uma requisição HTTP a partir do servidor.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { classifyWebsite } from './classify';

export type SiteStatus =
  | 'ok'
  | 'sem_https'
  | 'fora_do_ar'
  | 'nao_encontrado'
  | 'em_construcao'
  | 'virou_social'
  | 'certificado_vencido'
  | 'bloqueado';

export interface Verificacao {
  status: SiteStatus;
  /** true quando o resultado devolve o comércio para a lista de oportunidades */
  viraLead: boolean;
  detalhe: string;
  urlFinal: string | null;
  httpStatus: number | null;
}

const TIMEOUT_MS = 12000;

/** um navegador comum; alguns servidores recusam requisições sem isto */
const CABECALHOS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

/**
 * Sinais de página sem conteúdo real. Conservador de propósito: marcar um
 * site bom como "em construção" faria você deixar de lado um lead que não
 * era lead, mas também sujaria a lista com falso positivo.
 */
const SINAIS_PARADO = [
  'em construção',
  'em construcao',
  'under construction',
  'site em manutenção',
  'coming soon',
  'em breve',
  'página não encontrada',
  'this domain is for sale',
  'domínio à venda',
  'domain for sale',
  'buy this domain',
  'parked domain',
  'domínio registrado',
  'registro.br',
  'hospedagem de sites',
  'default web page',
  'apache2 ubuntu default page',
  'welcome to nginx',
  'it works!',
  'index of /',
  'account suspended',
  'conta suspensa',
  'esta conta foi suspensa',
];

function textoVisivel(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O endereço do "site" vem de quem cadastrou o lead, então pode apontar para
 * dentro da rede do servidor (127.0.0.1, 10.x, 169.254.169.254...). Abrir
 * isso seria SSRF: o servidor buscando o que nunca deveria ficar exposto.
 * Só passa endereço público, nas portas da web, conferido a cada redirecionamento.
 */
function ipInterno(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const x = ip.toLowerCase();
  return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x);
}

class EnderecoInterno extends Error {
  name = 'EnderecoInterno';
}

async function conferirEndereco(u: URL): Promise<void> {
  if (!/^https?:$/.test(u.protocol) || !['', '80', '443'].includes(u.port) || u.username || u.password) {
    throw new EnderecoInterno('endereço fora do padrão da web');
  }
  const host = u.hostname.replace(/^[|]$/g, '');
  if (/^localhost$|.local$|.internal$/i.test(host)) throw new EnderecoInterno('endereço interno');
  const ips = isIP(host) ? [host] : (
        await lookup(host, { all: true }).catch((e: NodeJS.ErrnoException) => {
          // mesmo formato do erro do fetch, para "domínio não existe" continuar virando lead
          throw Object.assign(new Error(e.message), { cause: { code: e.code } });
        })
      ).map((r) => r.address);
  if (ips.some(ipInterno)) throw new EnderecoInterno('endereço interno');
}

async function buscar(url: string, limiteMs = TIMEOUT_MS): Promise<Response> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), limiteMs);
  try {
    let atual = new URL(url);
    // segue os redirecionamentos na mão para conferir cada destino
    for (let saltos = 0; saltos <= 5; saltos++) {
      await conferirEndereco(atual);
      const r = await fetch(atual, { redirect: 'manual', signal: controle.signal, headers: CABECALHOS, cache: 'no-store' });
      const proximo = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
      if (!proximo) return r;
      atual = new URL(proximo, atual);
    }
    throw new Error('redirecionamentos demais');
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Nem toda falha significa site morto.
 *
 * DNS que não resolve ou conexão recusada são conclusivos: não há nada no
 * ar. Já um tempo esgotado só diz que o site demorou — pode estar lento,
 * pode ser o servidor recusando robô. Marcar isso como "fora do ar" encheria
 * a lista de oportunidade falsa, então fica como não conclusivo.
 */
function classificarFalha(err: Error): Verificacao {
  const causa = (err as unknown as { cause?: { code?: string } }).cause;
  const codigo = causa?.code || '';

  if (/CERT|SSL|ERR_TLS/i.test(codigo)) {
    return {
      status: 'certificado_vencido',
      viraLead: true,
      detalhe: `O certificado de segurança está com problema (${codigo}). Quem tentar abrir vê um aviso vermelho de site perigoso.`,
      urlFinal: null,
      httpStatus: null,
    };
  }

  if (err.name === 'AbortError' || /TIMEOUT/i.test(codigo)) {
    return {
      status: 'bloqueado',
      viraLead: false,
      detalhe: 'O site demorou demais para responder. Pode estar apenas lento — confira na mão.',
      urlFinal: null,
      httpStatus: null,
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(codigo)) {
    return {
      status: 'fora_do_ar',
      viraLead: true,
      detalhe:
        codigo.includes('ENOTFOUND') || codigo.includes('EAI_AGAIN')
          ? 'O domínio não existe mais — provavelmente venceu e ninguém renovou.'
          : 'O servidor recusou a conexão. O endereço está cadastrado no Google mas não abre.',
      urlFinal: null,
      httpStatus: null,
    };
  }

  return {
    status: 'bloqueado',
    viraLead: false,
    detalhe: 'Não consegui abrir o site para conferir. Vale checar na mão.',
    urlFinal: null,
    httpStatus: null,
  };
}

export async function verificarSite(urlBruta: string | null): Promise<Verificacao | null> {
  if (!urlBruta) return null;

  const url = urlBruta.startsWith('http') ? urlBruta : 'https://' + urlBruta;

  let resp: Response;
  try {
    resp = await buscar(url);
  } catch (err) {
    // https falhou: pode ser um site velho que só existe em http
    if (url.startsWith('https://')) {
      try {
        const alt = await buscar('http://' + url.slice(8));
        if (alt.ok) {
          return {
            status: 'sem_https',
            viraLead: true,
            detalhe: 'O site existe, mas só em HTTP — sem cadeado, o navegador marca como não seguro.',
            urlFinal: alt.url,
            httpStatus: alt.status,
          };
        }
      } catch {
        // segue para a classificação do erro original
      }
    }
    return classificarFalha(err as Error);
  }

  // o site pode ter virado um redirecionamento para rede social
  const destino = classifyWebsite(resp.url);
  if (destino.kind !== 'site' && destino.kind !== 'weak') {
    return {
      status: 'virou_social',
      viraLead: true,
      detalhe: `O endereço leva para ${destino.host} — não é um site próprio.`,
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  if (resp.status === 403 || resp.status === 429) {
    return {
      status: 'bloqueado',
      viraLead: false,
      detalhe: 'O site respondeu bloqueando a verificação. Provavelmente está no ar; confira na mão.',
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  if (resp.status >= 400) {
    return {
      status: resp.status < 500 ? 'nao_encontrado' : 'fora_do_ar',
      viraLead: true,
      detalhe: `O site respondeu com erro ${resp.status}. Quem clicar no Google não vai achar nada.`,
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  const html = (await resp.text().catch(() => '')).slice(0, 200_000);
  const texto = textoVisivel(html).toLowerCase();

  const sinal = SINAIS_PARADO.find((s) => texto.includes(s));
  if (sinal) {
    return {
      status: 'em_construcao',
      viraLead: true,
      detalhe: `A página no ar não é um site de verdade (encontrei “${sinal}”).`,
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  /*
   * Página que responde 200 mas quase sem texto.
   *
   * Cuidado: site feito em React, Vue ou Next monta o conteúdo por
   * JavaScript, então o HTML que chega tem título e scripts e quase nenhum
   * texto — medido num site real de barbearia: 30 KB de HTML para 77
   * caracteres visíveis. Julgar só pelo texto marcaria justamente os sites
   * bem-feitos como abandonados. Por isso só vale quando o HTML inteiro
   * também é pequeno, que é o caso de página de hospedagem e placeholder.
   */
  if (texto.length < 220 && html.length < 2500) {
    return {
      status: 'em_construcao',
      viraLead: true,
      detalhe: 'A página abre, mas não tem conteúdo — é um endereço vazio.',
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  if (resp.url.startsWith('http://')) {
    return {
      status: 'sem_https',
      viraLead: true,
      detalhe: 'O site funciona, mas sem HTTPS — o navegador avisa que não é seguro.',
      urlFinal: resp.url,
      httpStatus: resp.status,
    };
  }

  return {
    status: 'ok',
    viraLead: false,
    detalhe: 'Site no ar e funcionando.',
    urlFinal: resp.url,
    httpStatus: resp.status,
  };
}

export const ROTULO_SITE: Record<SiteStatus, string> = {
  ok: 'Site no ar',
  sem_https: 'Sem HTTPS',
  fora_do_ar: 'Site fora do ar',
  nao_encontrado: 'Site com erro',
  em_construcao: 'Site vazio',
  virou_social: 'Vai para rede social',
  certificado_vencido: 'Certificado vencido',
  bloqueado: 'Não deu para checar',
};

/**
 * Lê uma página pública (Linktree, bit.ly, site do comércio) com as mesmas
 * travas da verificação: só endereço público, cada redirecionamento conferido,
 * tempo curto e no máximo 400 KB. Devolve null se não abrir.
 */
export async function lerPagina(url: string, limiteMs = 6000): Promise<{ url: string; html: string } | null> {
  try {
    const r = await buscar(url, limiteMs);
    if (!r.ok) return null;
    const tipo = r.headers.get('content-type') || '';
    if (tipo && !/html|text/i.test(tipo)) return { url: r.url, html: '' };
    const leitor = r.body?.getReader();
    if (!leitor) return { url: r.url, html: '' };
    const partes: Uint8Array[] = [];
    let total = 0;
    while (total < 400_000) {
      const { done, value } = await leitor.read();
      if (done || !value) break;
      partes.push(value);
      total += value.length;
    }
    leitor.cancel().catch(() => {});
    return { url: r.url, html: Buffer.concat(partes).toString('utf8') };
  } catch {
    return null;
  }
}
