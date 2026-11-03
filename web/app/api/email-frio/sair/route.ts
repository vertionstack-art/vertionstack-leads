import { assinaturaDescadastro, bloquear } from '@/lib/email-frio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Não quero receber mais", em inglês porque quem clica é o lead lá de fora.
 *
 * O link do rodapé abre uma página com um botão (GET não descadastra:
 * antivírus de e-mail abre os links sozinho e descadastraria todo mundo).
 * O botão, e o "cancelar inscrição" do próprio Gmail (List-Unsubscribe-Post),
 * fazem POST, e aí o endereço vai para emails_bloqueados para sempre.
 */

function valido(email: string, t: string): boolean {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i.test(email) || !/^[0-9a-f]{32}$/.test(t)) return false;
  try {
    return assinaturaDescadastro(email) === t;
  } catch {
    return false;
  }
}

const pagina = (titulo: string, texto: string, form = '') =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title>
<style>body{margin:0;background:#F8F7FB;font-family:Arial,Helvetica,sans-serif;color:#12101B}main{max-width:460px;margin:12vh auto;padding:0 16px}
.c{background:#fff;border:1px solid #E7E4EF;border-radius:16px;padding:28px}h1{font-size:20px;margin:0 0 10px}p{color:#565068;line-height:1.5;margin:0 0 18px}
button{background:#12101B;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:bold;cursor:pointer}</style></head>
<body><main><div class="c"><h1>${titulo}</h1><p>${texto}</p>${form}</div></main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const e = (u.searchParams.get('e') || '').toLowerCase().slice(0, 200);
  const t = u.searchParams.get('t') || '';
  if (!valido(e, t)) return pagina('Link not valid', 'This link is incomplete. You can also just reply to the email with "no thanks".');
  return pagina(
    'Stop these emails?',
    `Click below and <b>${esc(e)}</b> won't get any more emails from Vertion Stack.`,
    `<form method="post" action="/api/email-frio/sair?e=${encodeURIComponent(e)}&t=${t}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: Request) {
  const u = new URL(req.url);
  const e = (u.searchParams.get('e') || '').toLowerCase().slice(0, 200);
  const t = u.searchParams.get('t') || '';
  if (!valido(e, t)) return pagina('Link not valid', 'This link is incomplete. You can also just reply to the email with "no thanks".');
  await bloquear(e, 'link');
  return pagina('Done', "You won't hear from us again. Sorry for the interruption.");
}
