import { NextResponse } from 'next/server';
import { db } from '@/lib/sql';
import { dentroDaJanela, enviadosHoje, gmailLigado, tetoPorDia } from '@/lib/email-frio';
import { enviarUm } from '@/lib/email-frio-envio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** quantos saem por rodada no horário comercial: a rodada é a cada 15 min, então a janela de 2h30 solta até ~30 */
const POR_RODADA = 3;

/** a senha que o pg_cron do Supabase usa (gerada e guardada só no banco, migração 0037) */
async function segredoDoBanco(): Promise<string | null> {
  try {
    const [r] = await db()`select valor from segredos_internos where nome = 'cron_emails'`;
    return (r?.valor as string) || null;
  } catch {
    return null;
  }
}

/**
 * Manda os e-mails aprovados que já podem sair:
 *  - os que você marcou para uma hora (enviar_em: agora, daqui a 5 min,
 *    de 5 em 5, de 10 em 10), assim que a hora chega;
 *  - os demais, quando o horário comercial de lá está aberto (3 por rodada).
 * Chamado a cada 15 minutos pelo GitHub Actions (.github/workflows/emails.yml,
 * senha EMAIL_CRON_SECRET) e, a cada minuto em que há e-mail marcado vencido,
 * pelo pg_cron do Supabase (?agendados=1, senha guardada no banco).
 */
export async function GET(req: Request) {
  const segredos = [process.env.EMAIL_CRON_SECRET, process.env.CRON_SECRET, await segredoDoBanco()].filter((x): x is string => Boolean(x && x.length >= 16));
  const veio = req.headers.get('authorization') || '';
  if (!segredos.some((x) => veio === `Bearer ${x}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!gmailLigado()) return NextResponse.json({ ok: true, enviados: 0, motivo: 'gmail desligado' });

  const restam = tetoPorDia() - (await enviadosHoje());
  if (restam <= 0) return NextResponse.json({ ok: true, enviados: 0, motivo: 'teto do dia' });

  const soAgendados = new URL(req.url).searchParams.get('agendados') === '1';
  const marcados = await db()`select id from emails_frios where status = 'aprovado' and enviar_em is not null and enviar_em <= now() order by enviar_em asc limit 10`;
  const janela = soAgendados
    ? []
    : (await db()`select id, fuso from emails_frios where status = 'aprovado' and enviar_em is null order by aprovado_em asc limit 100`)
        .filter((e) => dentroDaJanela(e.fuso as string))
        .slice(0, POR_RODADA);
  const agora = [...marcados, ...janela].slice(0, restam);

  let enviados = 0;
  const erros: string[] = [];
  for (const e of agora) {
    const r = await enviarUm(e.id as string);
    if (r.ok) enviados++;
    else if (!r.pulado) erros.push(r.erro.slice(0, 120));
    // senha errada vale para todos: não adianta tentar os outros
    if (!r.ok && r.loginRecusado) break;
  }
  return NextResponse.json({ ok: true, enviados, marcados: marcados.length, naJanela: janela.length, erros });
}
