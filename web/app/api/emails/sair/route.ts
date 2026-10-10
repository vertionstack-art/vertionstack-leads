import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/sql';
import { assinaturaSair } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pagina = (titulo: string, texto: string) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${titulo}</title></head>
<body style="margin:0;background:#eceaf5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#0b0b0f">
<div style="max-width:480px;margin:48px auto;background:#fff;border-radius:24px;padding:32px">
<h1 style="margin:0 0 12px;font-size:24px">${titulo}</h1><p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46">${texto}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } },
  );

/** o link "não quero receber" dos avisos que não são da conta (compra pela metade) */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const conta = u.searchParams.get('c') || '';
  const t = u.searchParams.get('t') || '';
  const certo = /^[0-9a-f-]{36}$/.test(conta) ? assinaturaSair(conta) : '';
  if (!certo || t.length !== certo.length || !timingSafeEqual(Buffer.from(t), Buffer.from(certo))) {
    return pagina('Link inválido', 'Este link não é válido. Se quiser parar de receber os avisos, responda qualquer e-mail nosso.');
  }
  await db()`update contas set emails_aviso = false where id = ${conta}`;
  return pagina('Pronto', 'Você não vai mais receber esses avisos. Os e-mails da sua conta (teste e vencimento do plano) continuam chegando.');
}
