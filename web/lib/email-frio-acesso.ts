import { NextResponse } from 'next/server';
import { exigirSessao } from './auth';
import { podeUsarConversa } from './conversa-contexto';
import type { Sessao } from './conta';

/**
 * O e-mail frio sai pelo Gmail do Lucas: só a conta dele usa esta parte,
 * pela mesma regra das conversas de WhatsApp (CONVERSA_EMAILS).
 */
export async function exigirEmailFrio(): Promise<{ sessao: Sessao; erro?: never } | { sessao?: never; erro: NextResponse }> {
  const s = await exigirSessao();
  if (s.erro) return s;
  if (!podeUsarConversa(s.sessao.email)) return { erro: NextResponse.json({ ok: false, erro: 'Não disponível nesta conta.' }, { status: 403 }) };
  return s;
}
