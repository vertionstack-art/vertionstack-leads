import { NextResponse } from 'next/server';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { exigirEmailFrio } from '@/lib/email-frio-acesso';
import { FALTA_GMAIL, gmailLigado, mandarPeloGmail } from '@/lib/email-frio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORPO = `Hi there,

This is a test from Vertion Leads. If you are reading it, the Gmail connection works and the approved emails will go out from this address.

Below is exactly how the signature, the address and the unsubscribe line look to the business that receives the email.

Best,
Lucas`;

/** manda um e-mail de exemplo para o próprio Gmail: confere a senha de app antes do primeiro cliente */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirEmailFrio();
  if (s.erro) return s.erro;
  if (!gmailLigado()) return NextResponse.json({ ok: false, erro: FALTA_GMAIL }, { status: 503 });
  if (await estourou('email-teste:' + s.sessao.userId, 5, 60 * 60)) return NextResponse.json({ ok: false, erro: 'Muitos testes seguidos. Espere um pouco.' }, { status: 429 });
  try {
    await mandarPeloGmail(process.env.GMAIL_USUARIO!, 'Teste da Vertion Leads', CORPO);
    return NextResponse.json({ ok: true, msg: `Mandei para ${process.env.GMAIL_USUARIO}. Confira a caixa de entrada.` });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const login = /Invalid login|Username and Password not accepted|535|534/i.test(m);
    return NextResponse.json(
      { ok: false, erro: login ? 'O Gmail recusou a senha de app. Crie outra em myaccount.google.com → Senhas de app e troque GMAIL_SENHA_APP na Vercel (depois Redeploy).' : `O Gmail não aceitou: ${m.slice(0, 200)}` },
      { status: 502 },
    );
  }
}
