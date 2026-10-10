/**
 * Envio de e-mail pela API do Resend (domínio vertionstack.com já verificado).
 *
 * Sem RESEND_API_KEY na Vercel nada é enviado e nada quebra: a ferramenta
 * segue igual, só sem os avisos. O HTML usa só estilo inline e tabela,
 * que é o que os leitores de e-mail (Gmail, Outlook) entendem.
 */

import { createHmac } from 'node:crypto';

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://leads.vertionstack.com').replace(/\/$/, '');
const REMETENTE = process.env.EMAIL_REMETENTE || 'Vertion Leads <avisos@vertionstack.com>';
const RESPONDER_PARA = process.env.EMPRESA_EMAIL || 'vertionstack@gmail.com';

export const emailLigado = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Mensagem {
  /** linha cinza que aparece ao lado do assunto na caixa de entrada */
  previa: string;
  titulo: string;
  /** parágrafos; **negrito** vira <b> */
  paragrafos: string[];
  botao?: { texto: string; url: string };
  /** link de "não quero receber" (só nos avisos que não são da conta) */
  sair?: string;
}

function negrito(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b style="color:#0b0b0f">$1</b>');
}

export function montarHtml(m: Mensagem): string {
  const corpo = m.paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${negrito(p)}</p>`)
    .join('');
  const botao = m.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px"><tr><td style="border-radius:999px;background:#0b0b0f">
         <a href="${esc(m.botao.url)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(m.botao.texto)}</a>
       </td></tr></table>`
    : '';
  const sair = m.sair
    ? ` <a href="${esc(m.sair)}" style="color:#71717a;text-decoration:underline">Não quero receber estes avisos</a>.`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(m.titulo)}</title></head>
<body style="margin:0;padding:0;background:#eceaf5;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(m.previa)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceaf5;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px">
      <tr><td style="padding:32px 32px 8px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td><img src="${SITE}/logo.png" width="32" height="32" alt="" style="display:block"></td>
          <td style="padding-left:10px;font-size:16px;font-weight:800;color:#0b0b0f">Vertion Leads</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 32px 28px">
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:#0b0b0f">${esc(m.titulo)}</h1>
        ${corpo}
        ${botao}
      </td></tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a">
      Você recebe este e-mail porque tem conta no Vertion Leads. Dúvidas? É só responder.${sair}
    </p>
  </td></tr>
</table></body></html>`;
}

export function montarTexto(m: Mensagem): string {
  return [m.titulo, '', ...m.paragrafos.map((p) => p.replace(/\*\*/g, '')), m.botao ? `${m.botao.texto}: ${m.botao.url}` : '', m.sair ? `Não quero receber: ${m.sair}` : '']
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}

/** devolve true se o Resend aceitou o e-mail */
export async function enviarEmail(para: string, assunto: string, m: Mensagem): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMETENTE,
        to: [para],
        reply_to: RESPONDER_PARA,
        subject: assunto,
        html: montarHtml(m),
        text: montarTexto(m),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error('[email]', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('[email]', e);
    return false;
  }
}

// ------------------------------------------- "não quero receber"

function segredo(): string {
  return process.env.EMAIL_SECRET || process.env.PROPOSTA_SECRET || process.env.INGEST_TOKEN || process.env.SUPABASE_DB_URL || 'vertion-leads';
}

export function assinaturaSair(conta: string): string {
  return createHmac('sha256', segredo()).update('sair:' + conta).digest('hex').slice(0, 32);
}

export function linkSair(conta: string): string {
  return `${SITE}/api/emails/sair?c=${conta}&t=${assinaturaSair(conta)}`;
}
