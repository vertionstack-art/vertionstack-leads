/**
 * Acha o e-mail de uma empresa de fora a partir do site dela.
 *
 * Lá fora o e-mail é o canal principal, e ele raramente está só na página
 * inicial: fica em "Contact", "About" ou no rodapé, às vezes escondido do
 * robô de spam (Cloudflare, "info [at] site [dot] com"). Por isso aqui se lê
 * a inicial e até três páginas de contato do mesmo site.
 *
 * Só vale e-mail do próprio domínio do site ou de provedor pessoal (Gmail,
 * Outlook…). E-mail de outro domínio quase sempre é da agência que fez o
 * site ("site by ..."), e mandar proposta de site para a agência é o pior
 * erro possível. E só vale domínio que recebe e-mail (registro MX).
 */

import { resolveMx } from 'node:dns/promises';
import { emailValido } from './email-lead';
import { lerPagina } from './verificar-site';

const PESSOAIS = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|zoho|gmx|mail)\.[a-z.]+$/i;

/** o e-mail costuma estar no rodapé, e página de construtor de site passa fácil de 700 KB */
const MAX_PAGINA = 1_500_000;

/** páginas que costumam ter o e-mail */
const PAGINA_DE_CONTATO = /contact|get-in-touch|reach-us|about|our-team|team|book|appointment|location|visit|impressum/i;

/** e-mail da Cloudflare: o endereço vem embaralhado com uma chave no primeiro byte */
function decodificarCloudflare(hex: string): string | null {
  try {
    const chave = parseInt(hex.slice(0, 2), 16);
    let s = '';
    for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ chave);
    return s;
  } catch {
    return null;
  }
}

function entidades(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&commat;|&#64;/gi, '@')
    .replace(/&period;/gi, '.')
    .replace(/&amp;/gi, '&');
}

/** todos os e-mails que aparecem num HTML, já validados, sem repetir */
export function emailsNoHtml(htmlCru: string): string[] {
  const html = entidades(htmlCru);
  const achados: string[] = [];
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]{6,})["']/gi)) achados.push(decodificarCloudflare(m[1]) || '');
  for (const m of html.matchAll(/email-protection#([0-9a-f]{6,})/gi)) achados.push(decodificarCloudflare(m[1]) || '');
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    try {
      achados.push(decodeURIComponent(m[1]));
    } catch {
      achados.push(m[1]);
    }
  }
  for (const m of html.matchAll(/"email"\s*:\s*"([^"]{5,120})"/gi)) achados.push(m[1]);
  // "info [at] site [dot] com", "info(at)site.com"
  const semTags = html.replace(/<[^>]+>/g, ' ');
  for (const m of semTags.matchAll(/([a-z0-9._%+-]{2,40})\s*[[(]\s*at\s*[\])]\s*([a-z0-9-]{2,60})\s*(?:[[(]\s*dot\s*[\])]|\.)\s*([a-z]{2,10}(?:\s*(?:[[(]\s*dot\s*[\])]|\.)\s*[a-z]{2,6})?)/gi)) {
    achados.push(`${m[1]}@${m[2]}.${m[3].replace(/\s*(?:[[(]\s*dot\s*[\])]|\.)\s*/gi, '.')}`);
  }
  achados.push(...(semTags.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) || []));
  const vistos = new Set<string>();
  const ok: string[] = [];
  for (const a of achados) {
    const v = emailValido(a);
    if (v && !vistos.has(v)) {
      vistos.add(v);
      ok.push(v);
    }
  }
  return ok;
}

function dominioBase(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** o e-mail serve para esta empresa? (do domínio dela ou pessoal) */
function daEmpresa(email: string, hostSite: string | null): 'dominio' | 'pessoal' | null {
  const dom = email.split('@')[1];
  if (hostSite) {
    const base = dominioBase(hostSite);
    if (dom === base || base.endsWith('.' + dom) || dom.endsWith('.' + base)) return 'dominio';
  }
  return PESSOAIS.test(dom) ? 'pessoal' : null;
}

/** prefere caixa de contato geral ou do dono; evita as de vagas, imprensa e cobrança */
function pesoDoNome(email: string): number {
  const u = email.split('@')[0];
  if (/^(jobs|careers|hr|press|media|billing|invoices?|accounts|payroll|privacy|legal|abuse|postmaster|webmaster|admin)$/.test(u)) return -5;
  if (/^(info|hello|hi|contact|office|enquiries|inquiries|book|bookings|appointments|reception|team|studio|shop|sales)$/.test(u)) return 2;
  return 1; // nome de pessoa costuma ser o dono
}

const cacheMx = new Map<string, boolean>();

/** o domínio recebe e-mail? (tem registro MX) */
export async function recebeEmail(email: string): Promise<boolean> {
  const dom = email.split('@')[1];
  if (!dom) return false;
  if (PESSOAIS.test(dom)) return true;
  if (cacheMx.has(dom)) return cacheMx.get(dom)!;
  const r = await Promise.race([
    resolveMx(dom).then((mx) => mx.length > 0, () => false),
    new Promise<boolean>((ok) => setTimeout(() => ok(false), 4000)),
  ]);
  cacheMx.set(dom, r);
  return r;
}

export interface EmailAchado {
  email: string;
  /** a página onde ele estava */
  fonte: string;
}

/**
 * Lê a página inicial (já baixada, quando houver) e até 3 páginas de contato,
 * e devolve o melhor e-mail da empresa que recebe mensagem.
 */
export async function acharEmailDaEmpresa(site: string, home?: { url: string; html: string } | null): Promise<EmailAchado | null> {
  const inicio = home ?? (await lerPagina(site, 6000, MAX_PAGINA));
  if (!inicio?.html) return null;
  let host: string | null = null;
  try {
    host = new URL(inicio.url || site).hostname;
  } catch {
    return null;
  }

  const candidatos: { email: string; fonte: string; peso: number }[] = [];
  const juntar = (html: string, fonte: string) => {
    for (const e of emailsNoHtml(html)) {
      const tipo = daEmpresa(e, host);
      if (!tipo) continue;
      candidatos.push({ email: e, fonte, peso: (tipo === 'dominio' ? 10 : 6) + pesoDoNome(e) });
    }
  };
  juntar(inicio.html, inicio.url || site);

  // páginas de contato do mesmo site, achadas nos links da inicial
  const achados = new Set<string>();
  for (const m of inicio.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (!PAGINA_DE_CONTATO.test(m[1])) continue;
    try {
      const u = new URL(m[1], inicio.url || site);
      if (u.hostname === host && /^https?:$/.test(u.protocol)) achados.add(u.href.split('#')[0]);
    } catch {
      // link quebrado: ignora
    }
  }
  // "contact" primeiro: é onde o e-mail mais aparece; "about" e o resto depois
  const links = new Set([...achados].sort((a, b) => Number(!/contact|get-in-touch|reach-us/i.test(a)) - Number(!/contact|get-in-touch|reach-us/i.test(b))).slice(0, 3));
  if (!candidatos.some((c) => c.peso >= 12) && links.size) {
    const paginas = await Promise.all([...links].map((u) => lerPagina(u, 5000, MAX_PAGINA).catch(() => null)));
    paginas.forEach((p, i) => p?.html && juntar(p.html, [...links][i]));
  }

  candidatos.sort((a, b) => b.peso - a.peso);
  for (const c of candidatos) {
    if (c.peso <= 4) break;
    if (await recebeEmail(c.email)) return { email: c.email, fonte: c.fonte };
  }
  return null;
}
