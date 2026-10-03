/**
 * O que toda rota de login, cadastro e senha confere antes de falar com o
 * Supabase: se o pedido veio do nosso site, se o endereço não está
 * bloqueado, e se não passou do limite de tentativas.
 *
 * Os limites contam por IP e por e-mail separadamente: por IP pega o robô
 * que tenta mil e-mails; por e-mail pega quem tenta mil senhas numa conta
 * trocando de IP.
 */

import { NextResponse } from 'next/server';
import { origemConfere } from './auth';
import { estaBloqueado, ipDaRequisicao } from './acessos';
import { estourou } from './limite';

export function resposta(erro: string, status: number) {
  return NextResponse.json({ ok: false, erro }, { status });
}

export async function barrarSePreciso(
  req: Request,
  acao: string,
  email: string | null,
  limites: { porIp: number; porEmail: number; janelaSegundos: number },
): Promise<NextResponse | null> {
  if (!origemConfere(req)) return resposta('Pedido recusado.', 403);
  const ip = ipDaRequisicao(req);
  if (await estaBloqueado(ip)) return resposta('Acesso não permitido.', 403);

  const minutos = Math.round(limites.janelaSegundos / 60);
  const espere = `Muitas tentativas. Espere ${minutos} minutos e tente de novo.`;
  if (await estourou(`${acao}:ip:${ip}`, limites.porIp, limites.janelaSegundos)) return resposta(espere, 429);
  if (email && (await estourou(`${acao}:email:${email}`, limites.porEmail, limites.janelaSegundos))) {
    return resposta(espere, 429);
  }
  return null;
}

export function emailValido(v: unknown): string | null {
  const e = String(v || '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254 ? e : null;
}

/** o endereço do próprio site, para os links que vão por e-mail */
export function origemDoSite(req: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const u = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || u.host;
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  return `${proto}://${host}`;
}
