/**
 * Ponte entre o painel do PC (aba LANDING) e o e-mail do exterior.
 *
 * Quando a landing de um lead do exterior é publicada, o painel mostra o
 * e-mail dele ali mesmo: escrever (a mesma IA e as mesmas regras do site),
 * pôr o valor, ajustar e aprovar. Aprovado entra na mesma fila do site, e
 * quem envia continua sendo o cron, no horário comercial de lá e dentro do
 * teto do dia. Este script não envia nada.
 *
 * Uso (o painel chama assim, com um JSON na entrada):
 *   node <tsx> scripts/painel-email.mts  < {"acao":"ver","leadId":"..."}
 * Ações: ver, gerar, mexer (id + mudanca), endereco (leadId + email).
 * Responde uma linha JSON.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const l of readFileSync(join(WEB, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const DONO = 'vertionstack@gmail.com';

const { db } = await import('../lib/sql');
const { atualizarLead, buscarLead } = await import('../lib/db');
const { gerarEmail, mexerNoEmail, umEmail } = await import('../lib/email-frio-fila');
const { enviadosHoje, estaBloqueado, fusoDoLead, dentroDaJanela, proximaJanela, tetoPorDia } = await import('../lib/email-frio');
const { ErroIa } = await import('../lib/cabeca');

function responder(o: unknown): never {
  process.stdout.write(JSON.stringify(o) + '\n');
  process.exit(0);
}

const entrada = JSON.parse(readFileSync(0, 'utf8') || '{}') as { acao?: string; leadId?: string; id?: string; email?: string; mudanca?: Record<string, unknown> };

try {
  const [c] = await db()`select conta_id from membros where user_id = (select public.usuario_pelo_email(${DONO})) limit 1`;
  const conta = c?.conta_id as string | undefined;
  if (!conta) responder({ ok: false, erro: 'Conta da Vertion não encontrada.' });

  const leadId = String(entrada.leadId || '').slice(0, 300);
  const doLead = async () => {
    const [r] = await db()`select id from emails_frios where conta_id = ${conta!} and lead_id = ${leadId} and status <> 'cancelado' order by criado_em desc limit 1`;
    return r ? umEmail(conta!, r.id as string) : null;
  };

  if (entrada.acao === 'ver') {
    const lead = await buscarLead(conta!, leadId);
    if (!lead) responder({ ok: false, erro: 'Lead não encontrado.' });
    const fuso = fusoDoLead(lead);
    responder({
      ok: true,
      para: lead.email,
      bloqueado: lead.email ? await estaBloqueado(lead.email) : false,
      demo: lead.previaUrl,
      fuso,
      cidade: lead.city,
      agoraLa: dentroDaJanela(fuso),
      proximaJanela: proximaJanela(fuso).toISOString(),
      hoje: await enviadosHoje(),
      teto: tetoPorDia(),
      email: await doLead(),
    });
  }

  if (entrada.acao === 'gerar') responder({ ok: true, email: await gerarEmail(conta!, leadId) });

  if (entrada.acao === 'mexer') {
    const e = await umEmail(conta!, String(entrada.id || ''));
    if (!e || e.leadId !== leadId) responder({ ok: false, erro: 'E-mail não encontrado.' });
    responder(await mexerNoEmail(conta!, e.id, entrada.mudanca || {}));
  }

  if (entrada.acao === 'endereco') {
    const email = String(entrada.email || '').trim().toLowerCase();
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(email) || email.length > 200) responder({ ok: false, erro: 'Esse e-mail não parece válido.' });
    const lead = await atualizarLead(conta!, leadId, { email });
    responder(lead ? { ok: true } : { ok: false, erro: 'Lead não encontrado.' });
  }

  responder({ ok: false, erro: 'Ação desconhecida.' });
} catch (e) {
  responder({ ok: false, erro: e instanceof ErroIa ? 'A IA não respondeu agora (limite do plano grátis). Tente de novo em um minuto.' : e instanceof Error ? e.message : String(e) });
}
