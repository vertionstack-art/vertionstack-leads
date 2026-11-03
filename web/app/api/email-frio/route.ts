import { NextResponse } from 'next/server';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { cabecaLigada, ErroIa, FALTA_CABECA } from '@/lib/cabeca';
import { exigirEmailFrio } from '@/lib/email-frio-acesso';
import { candidatosEmail, emailsDaConta, gerarEmail } from '@/lib/email-frio-fila';
import { enviadosHoje, gmailLigado, tetoPorDia } from '@/lib/email-frio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** a fila inteira: quem pode receber, os e-mails escritos e o teto do dia */
export async function GET() {
  const s = await exigirEmailFrio();
  if (s.erro) return s.erro;
  const { contaId } = s.sessao;
  const [candidatos, emails, hoje] = await Promise.all([candidatosEmail(contaId), emailsDaConta(contaId), enviadosHoje()]);
  return NextResponse.json({ ok: true, candidatos, emails, enviadosHoje: hoje, teto: tetoPorDia(), gmail: gmailLigado() });
}

/** escreve o e-mail de um lead (a tela chama um por vez, em sequência) */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirEmailFrio();
  if (s.erro) return s.erro;
  if (!cabecaLigada()) return NextResponse.json({ ok: false, erro: FALTA_CABECA }, { status: 503 });
  if (await estourou('email-frio:' + s.sessao.userId, 120, 60 * 60)) return NextResponse.json({ ok: false, erro: 'Muitos e-mails gerados seguidos. Espere alguns minutos.' }, { status: 429 });
  const c = (await req.json().catch(() => ({}))) as { leadId?: unknown };
  const leadId = String(c.leadId || '').slice(0, 300);
  if (!leadId) return NextResponse.json({ ok: false, erro: 'Lead não informado.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, email: await gerarEmail(s.sessao.contaId, leadId) });
  } catch (e) {
    const msg = e instanceof ErroIa ? 'A IA não respondeu agora (limite do plano grátis). Tente de novo em um minuto.' : e instanceof Error ? e.message : 'Não consegui escrever o e-mail.';
    return NextResponse.json({ ok: false, erro: msg }, { status: 400 });
  }
}
