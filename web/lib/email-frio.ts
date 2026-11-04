/**
 * O e-mail para os leads do exterior: escrever, montar e mandar.
 *
 * Um e-mail só por empresa, sem sequência de etapas. A IA escreve em inglês
 * a partir do que a busca achou (o problema real do site, as avaliações, o
 * vizinho com site bom). O Lucas lê, ajusta e aprova; quem decide o envio é
 * ele, nunca a IA.
 *
 * O envio sai pelo Gmail dele (vertionstack@gmail.com, com senha de app) e
 * respeita três coisas:
 *  - horário comercial de lá: das 9h às 11h30 no fuso do lead, de segunda a
 *    sexta. E-mail que chega às 3 da manhã fica soterrado;
 *  - teto por dia (EMAIL_TETO_DIA, padrão 20): Gmail novo que dispara muito
 *    de uma vez vai para o spam e pode ser bloqueado;
 *  - a lei de e-mail frio (CAN-SPAM nos EUA, PECR/GDPR no Reino Unido e na
 *    Irlanda, Spam Act na Austrália): quem envia, endereço postal e um jeito
 *    de não receber mais, que vale para sempre (emails_bloqueados).
 */

import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Lead } from './db';
import { db } from './sql';
import { diagnostico, reputacao } from './prompt-gringa';
import { assinaturaHtml, assinaturaTexto, ASSINATURA } from './assinatura-email';
import { perguntarJson } from './cabeca';
import { NOME_DA_REDE, type Rede } from './redes';

export const REMETENTE_NOME = 'Lucas Teles';
export const ENDERECO_POSTAL = 'Rio de Janeiro - RJ, Rocinha, CEP 22451-450, Brazil';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://leads.vertionstack.com').replace(/\/$/, '');

export const gmailLigado = () => Boolean(process.env.GMAIL_USUARIO && process.env.GMAIL_SENHA_APP);
export const FALTA_GMAIL = 'Falta ligar o Gmail na Vercel (GMAIL_USUARIO e GMAIL_SENHA_APP).';

export function tetoPorDia(): number {
  const n = Number(process.env.EMAIL_TETO_DIA);
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.floor(n)) : 20;
}

// ------------------------------------------------------------------ fuso e janela

/**
 * O fuso do lead pelo país (o telefone) e pela longitude. Aproximado de
 * propósito: errar meia hora não importa numa janela de duas horas e meia.
 */
export function fusoDoLead(lead: Pick<Lead, 'phone' | 'lat' | 'lng' | 'city'>): string {
  const d = (lead.phone || '').replace(/\D/g, '');
  const lng = lead.lng ?? null;
  const lat = lead.lat ?? null;
  const cidade = (lead.city || '').toUpperCase();
  if (d.startsWith('44')) return 'Europe/London';
  if (d.startsWith('353')) return 'Europe/Dublin';
  if (d.startsWith('64')) return 'Pacific/Auckland';
  if (d.startsWith('61')) {
    if (lng !== null && lng < 129) return 'Australia/Perth';
    if (lng !== null && lng < 141) return 'Australia/Adelaide';
    if (/QLD/.test(cidade) || (lat !== null && lat > -29 && lng !== null && lng >= 141)) return 'Australia/Brisbane';
    return 'Australia/Sydney';
  }
  if (d.startsWith('1')) {
    // Canadá e EUA dividem o +1: a longitude decide o fuso
    if (lng === null) return 'America/New_York';
    if (lng >= -67) return 'America/Halifax';
    if (lng >= -87.5) return 'America/New_York';
    if (lng >= -101.5) return 'America/Chicago';
    if (/,\s*AZ\b/.test(cidade)) return 'America/Phoenix';
    if (lng >= -114.5) return 'America/Denver';
    return 'America/Los_Angeles';
  }
  return 'America/New_York';
}

const JANELA = { inicio: 9 * 60, fim: 11 * 60 + 30 }; // minutos do dia, hora de lá

function horaLocal(fuso: string, quando = new Date()): { minutos: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false }).formatToParts(quando);
  const h = Number(partes.find((p) => p.type === 'hour')?.value || 0) % 24;
  const m = Number(partes.find((p) => p.type === 'minute')?.value || 0);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.find((p) => p.type === 'weekday')?.value || '');
  return { minutos: h * 60 + m, diaSemana: dia };
}

/** agora é horário comercial no fuso do lead? */
export function dentroDaJanela(fuso: string, quando = new Date()): boolean {
  const { minutos, diaSemana } = horaLocal(fuso, quando);
  return diaSemana >= 1 && diaSemana <= 5 && minutos >= JANELA.inicio && minutos < JANELA.fim;
}

/** quando abre a próxima janela de envio, para mostrar na fila ("sai ter 9h em Austin") */
export function proximaJanela(fuso: string, agora = new Date()): Date {
  if (dentroDaJanela(fuso, agora)) return agora;
  // anda de 15 em 15 minutos até cair na janela (no máximo uma semana)
  const t = new Date(Math.ceil(agora.getTime() / 900_000) * 900_000);
  for (let i = 0; i < 7 * 96; i++) {
    if (dentroDaJanela(fuso, t)) return t;
    t.setTime(t.getTime() + 900_000);
  }
  return t;
}

// ------------------------------------------------------------------ escrever

const PROBLEMA_EM_INGLES: Record<string, string> = {
  sem_contato_direto: 'there is no clickable email or chat on the site',
  sem_whatsapp: 'there is no quick way to message them from the site',
  sem_telefone: 'the phone number is not tap-to-call on a phone',
  sem_contato: 'there is no contact form, booking or quote request',
  celular: 'the site does not adapt to phone screens',
  sem_https: 'browsers flag the site as "Not secure"',
  sem_descricao: 'it shows up on Google without a description of what they do',
  pouco_conteudo: 'there is very little information about their services',
  ano_antigo: 'the footer still shows an old year, which makes the business look inactive',
};

function fatos(lead: Lead): string {
  const d = diagnostico(lead);
  const problemas = (lead.siteAvaliacao?.problemas || []).map((p) => PROBLEMA_EM_INGLES[p.codigo]).filter(Boolean);
  const redes = Object.keys(lead.redes || {}).map((r) => NOME_DA_REDE[r as Rede] || r);
  const c = lead.concorrente;
  return [
    `- Business name: ${lead.name}`,
    lead.category ? `- Type of business: ${lead.category}` : null,
    lead.city ? `- City: ${lead.city}` : null,
    `- Reputation on Google: ${reputacao(lead)}`,
    `- What I found: ${d.situacao}`,
    problemas.length ? `- Specific problems I checked on their site myself: ${problemas.join('; ')}.` : null,
    `- Why it costs them: ${d.custo}`,
    `- Be careful: ${d.cuidado}`,
    redes.length ? `- They are active on: ${redes.join(', ')} (so they care about how they look online).` : null,
    c
      ? `- A competitor in the same area and same line of business, ${c.nome}, has a modern website (${c.site}) that I rated ${c.nota}/10. You may mention this competitor by name, factually, once, without attacking anyone.`
      : null,
    '- I ALREADY BUILT THEM A FREE DEMO WEBSITE, made for this business before we ever spoke. It is live. Write the token [DEMO] alone on its own line where the link goes; it is replaced by the real link when the email is sent.',
  ]
    .filter(Boolean)
    .join('\n');
}

const INSTRUCOES = `You are an elite B2B cold email copywriter writing for Lucas Teles, CEO of Vertion Stack, a small studio that builds websites for local businesses (delivered in 3 to 7 business days, fixed scope in writing). You write ONE cold email to the owner of a local business. Your emails get replies from owners who delete almost everything else.

Persuasion, used deliberately and honestly:
- Lead with a specific observation about THEIR business that proves a human looked. Never "I came across your business", never "your online presence".
- Problem, then the cost of it in terms the owner already feels (lost calls, customers going to the competitor), then the way out.
- Loss aversion beats gain framing. Their own Google reviews are social proof they already own: reflect it back.
- Sell the result (more people who find them online actually call or book), not "a website".
- One single call to action that costs nothing to answer in one line (a question), never "book a 15-minute call".

THE DEMO IS THE HEART OF EVERY EMAIL. A demo website is already built for them and live. This is reciprocity: I gave first, unasked.
- Say it as something already done ("I put together a demo of a new site for [business]"), never as an offer ("I could build you one").
- Never ask permission to show it ("would you like to see...?"): the link is already in the email.
- Call it a DEMO VERSION, in those words, so nobody mistakes it for the finished site.
- Say clearly that it is fully customizable: every text, color, section and photo can change, and we can add all the information they need (their own photos, full list of services, prices, service area, hours, booking or quote form, reviews). Never apologise for it or call it rough.
- Say in a few words what the demo already shows (mobile friendly, tap to call, a clear quote or booking button), only what fits this business.
- The call to action is about the demo: what they think of it, or what they would change or add first.

Structure (in this order):
1. One or two sentences on the specific thing you saw on their site or listing (from the facts).
2. What it costs them, said as a likely consequence ("people searching on a phone tend to call whoever is easiest to reach"), never as a fact about their numbers.
3. If a competitor is in the facts: one factual sentence naming it and saying its site makes contacting or booking easy. No attack.
4. The demo: one sentence saying you already built a demo version of a new site for them, then [DEMO] alone on its own line.
5. Right after the link, one or two sentences: what the demo already shows, and that it is a demo version, fully customizable, where we can add all the information they need (their photos, services, prices, hours and anything else).
6. One sentence on who is writing: Lucas, from Vertion Stack, builds websites for local businesses that turn visitors into calls and bookings, delivered in 3 to 7 business days.
7. The single question about the demo as call to action.

Hard rules:
- Invent NOTHING. No statistics, no clients, no case studies, no prices, no deadlines that are not in the facts. If a detail is not in the facts, leave it out.
- Never state anything about their internal numbers (calls, sales, missed customers, revenue): you do not know them. Talk about what visitors typically do, not about what happens inside their business.
- Use plain hyphens and commas. No em dashes or en dashes.
- No false urgency, no fake "Re:" in the subject, no exclamation marks, no emoji.
- Criticise the situation, never the owner or whoever built the old site.
- Native, plain American English (British spelling if the city is in the UK, Ireland, Australia or New Zealand). Short sentences. No corporate words (leverage, solutions, synergy, digital transformation).
- Subject: under 7 words, sentence case, with their business name, about the site you made for them (like "Website concept for Joe's Plumbing" or "I built a site for Joe's Plumbing"). Vary the wording.
- Do not write any price: if there is one, Lucas adds it after the demo.
- Body: 90 to 140 words (not counting [DEMO]), plain text, short paragraphs separated by a blank line. Start with "Hi" plus the business name or "there" (you do not know the owner's name). End with exactly "Best,\\nLucas". Do NOT write a signature, address or unsubscribe line: they are added automatically.

Return JSON: {"assunto": "...", "corpo": "..."}.`;

// ------------------------------------------------------------------ a demo

/** o lugar do link da demo no texto; no envio vira o link de verdade */
export const MARCA_DEMO = '[DEMO]';

/** a IA às vezes esquece o [DEMO] ou cola numa frase: ele fica sempre sozinho numa linha */
export function garantirDemo(corpo: string): string {
  if (corpo.includes(MARCA_DEMO)) return corpo.replace(/[ \t]*\[DEMO\][ \t]*/g, '\n[DEMO]\n').replace(/\n{3,}/g, '\n\n').trim();
  const p = corpo.split(/\n{2,}/);
  // depois do segundo parágrafo (o problema e o custo), antes de quem escreve
  p.splice(Math.min(2, p.length - 1), 0, `I built a demo version of a new site for you:\n${MARCA_DEMO}\n\nIt's fully customizable: we can change anything and add all the information you need, from your own photos to services, prices and hours.`);
  return p.join('\n\n');
}

/** link de demo aceito: endereço web completo (https) */
export function demoValida(url: unknown): string | null {
  const u = String(url ?? '').trim();
  if (!/^https:\/\/[^\s<>"']+\.[^\s<>"']+$/i.test(u) || u.length > 300) return null;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

export function comDemo(corpo: string, demo: string): string {
  return corpo.split(MARCA_DEMO).join(demo);
}

export interface EmailEscrito {
  assunto: string;
  corpo: string;
  modelo: string;
}

export async function escreverEmail(lead: Lead): Promise<EmailEscrito> {
  const r = await perguntarJson<{ assunto: string; corpo: string }>(INSTRUCOES, `Facts about the business (all verified):\n${fatos(lead)}\n\nWrite the email.`, {
    type: 'object',
    properties: { assunto: { type: 'string' }, corpo: { type: 'string' } },
    required: ['assunto', 'corpo'],
  });
  // travessão, hífen especial e aspas curvas denunciam texto de IA
  const limpar = (t: string) =>
    t
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/[‐‑‒]/g, '-')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
  const assunto = limpar(String(r.dados.assunto || '').replace(/[\r\n]+/g, ' ')).trim().slice(0, 120);
  let corpo = limpar(String(r.dados.corpo || '').replace(/\r/g, '')).replace(/\n{3,}/g, '\n\n').trim();
  // a IA às vezes esquece o fecho ou acrescenta assinatura: o fecho é sempre o mesmo
  corpo = corpo.replace(/\n+(best|regards|cheers|thanks|sincerely)[\s\S]*$/i, '').trim() + '\n\nBest,\nLucas';
  if (!assunto || corpo.length < 120) throw new Error('A IA devolveu um e-mail vazio. Tente gerar de novo.');
  corpo = garantirDemo(corpo);
  return { assunto, corpo: corpo.slice(0, 4000), modelo: r.modelo };
}

// ------------------------------------------------------------------ "não quero receber"

function segredo(): string {
  const s = process.env.EMAIL_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_DB_URL;
  if (!s) throw new Error('EMAIL_SECRET não configurado');
  return s;
}

export function assinaturaDescadastro(email: string): string {
  return createHmac('sha256', segredo()).update('frio-sair:' + email.toLowerCase()).digest('hex').slice(0, 32);
}

export function linkDescadastro(email: string): string {
  return `${SITE}/api/email-frio/sair?e=${encodeURIComponent(email.toLowerCase())}&t=${assinaturaDescadastro(email)}`;
}

export async function estaBloqueado(email: string): Promise<boolean> {
  const [r] = await db()`select 1 from emails_bloqueados where email = ${email.toLowerCase()}`;
  return Boolean(r);
}

export async function bloquear(email: string, origem: string): Promise<void> {
  await db()`insert into emails_bloqueados (email, origem) values (${email.toLowerCase()}, ${origem}) on conflict (email) do nothing`;
  // o que estava na fila para esse endereço não sai mais
  await db()`update emails_frios set status = 'cancelado', erro = 'Pediu para não receber' where lower(para) = ${email.toLowerCase()} and status in ('rascunho', 'aprovado')`;
}

// ------------------------------------------------------------------ montar

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** o corpo vira parágrafos simples: e-mail de pessoa, não de campanha */
function corpoEmHtml(corpo: string): string {
  return corpo
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#12101B;">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7A16E0;">$1</a>')}</p>`)
    .join('\n');
}

export function montarEmail(para: string, assunto: string, corpo: string): { html: string; texto: string; sair: string } {
  const sair = linkDescadastro(para);
  const rodapeTexto = `${ASSINATURA.empresa} · ${ENDERECO_POSTAL}\nIf you'd rather not hear from me again, just reply "no thanks" or open: ${sair}`;
  const html = `<div style="max-width:600px;">
${corpoEmHtml(corpo)}
${assinaturaHtml()}
<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#8a8597;">${esc(ASSINATURA.empresa)} &middot; ${esc(ENDERECO_POSTAL)}<br>If you'd rather not hear from me again, just reply "no thanks" or <a href="${sair}" style="color:#8a8597;">click here</a>.</p>
</div>`;
  const texto = `${corpo}\n\n${assinaturaTexto()}\n\n${rodapeTexto}`;
  return { html, texto, sair };
}

// ------------------------------------------------------------------ mandar

let transporte: nodemailer.Transporter | null = null;
function gmail(): nodemailer.Transporter {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USUARIO, pass: process.env.GMAIL_SENHA_APP },
    });
  }
  return transporte;
}

export async function mandarPeloGmail(para: string, assunto: string, corpo: string): Promise<string> {
  // trava final: e-mail com o [DEMO] sem trocar nunca sai
  if (corpo.includes(MARCA_DEMO)) throw new Error('Falta o link da demo neste e-mail.');
  const { html, texto, sair } = montarEmail(para, assunto, corpo);
  const r = await gmail().sendMail({
    from: { name: REMETENTE_NOME, address: process.env.GMAIL_USUARIO! },
    to: para,
    subject: assunto,
    text: texto,
    html,
    headers: {
      // o botão "cancelar inscrição" do próprio Gmail/Outlook usa estes dois
      'List-Unsubscribe': `<${sair}>, <mailto:${process.env.GMAIL_USUARIO}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  return r.messageId;
}

/** quantos e-mails frios já saíram hoje (dia de Brasília) */
export async function enviadosHoje(): Promise<number> {
  const [r] = await db()`
    select count(*)::int as n from emails_frios
    where status in ('enviado', 'enviando')
      and (enviado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
  `;
  return r?.n ?? 0;
}
