import { NextResponse } from 'next/server';
import { conferirImap, lerRespostas } from '@/lib/email-respostas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lê as respostas aos e-mails do exterior e move os leads (lib/email-respostas).
 * Chamado pelo mesmo agendador do envio, com a mesma senha.
 */
export async function GET(req: Request) {
  const segredos = [process.env.EMAIL_CRON_SECRET, process.env.CRON_SECRET].filter((s): s is string => Boolean(s && s.length >= 16));
  const veio = req.headers.get('authorization') || '';
  if (!segredos.some((s) => veio === `Bearer ${s}`)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    if (new URL(req.url).searchParams.get('conferir') === '1') return NextResponse.json({ ok: true, ...(await conferirImap()) });
    return NextResponse.json({ ok: true, ...(await lerRespostas()) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('[respostas]', m);
    return NextResponse.json({ ok: false, erro: /auth|login|credentials/i.test(m) ? 'O Gmail recusou a senha de app no IMAP.' : m.slice(0, 200) }, { status: 502 });
  }
}
