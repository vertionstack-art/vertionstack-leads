/**
 * O registro da conversa guiada com cada lead: as mensagens dos dois lados
 * (a do cliente é colada à mão) e os passos do roteiro já cumpridos.
 */

import { db } from './sql';
import { passoPorId } from './roteiro';

export interface MensagemConversa {
  id: number;
  autor: 'eu' | 'cliente';
  texto: string;
  passo: string | null;
  em: string;
  /** escrita pelo robô de vendas (lib/robo) */
  robo: boolean;
}

export const MAX_MENSAGENS = 300;

export async function mensagensDaConversa(conta: string, lead: string): Promise<MensagemConversa[]> {
  const r = await db()`
    select id, autor, texto, passo, criado_em, robo from conversa_mensagens
    where conta_id = ${conta} and lead_id = ${lead}
    order by criado_em, id
    limit ${MAX_MENSAGENS}
  `;
  return r.map((x) => ({
    id: Number(x.id),
    autor: x.autor as 'eu' | 'cliente',
    texto: x.texto as string,
    passo: (x.passo as string) || null,
    em: new Date(x.criado_em).toISOString(),
    robo: Boolean(x.robo),
  }));
}

export async function passosFeitos(conta: string, lead: string): Promise<string[]> {
  const r = await db()`select passo from conversa_passos where conta_id = ${conta} and lead_id = ${lead} order by feito_em`;
  return r.map((x) => x.passo as string);
}

export async function registrarMensagem(
  conta: string,
  lead: string,
  autor: 'eu' | 'cliente',
  texto: string,
  passo: string | null,
  /** id da mensagem no WhatsApp (Evolution): a mesma mensagem nunca entra duas vezes */
  externoId: string | null = null,
  robo = false,
): Promise<MensagemConversa | 'cheio' | 'repetida'> {
  const [n] = await db()`select count(*)::int as n from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead}`;
  if ((n.n as number) >= MAX_MENSAGENS) return 'cheio';
  const p = passoPorId(passo) ? passo : null;
  const linhas = await db()`
    insert into conversa_mensagens (conta_id, lead_id, autor, texto, passo, externo_id, robo)
    values (${conta}, ${lead}, ${autor}, ${texto}, ${p}, ${externoId}, ${robo})
    on conflict (conta_id, externo_id) where externo_id is not null do nothing
    returning id, criado_em
  `;
  if (!linhas.length) {
    // o webhook do WhatsApp gravou a mesma mensagem antes: só marca que foi do robô
    if (robo && externoId) await db()`update conversa_mensagens set robo = true where conta_id = ${conta} and externo_id = ${externoId}`;
    return 'repetida';
  }
  const [x] = linhas;
  if (p && autor === 'eu') await marcarPasso(conta, lead, p, true);
  return { id: Number(x.id), autor, texto, passo: p, em: new Date(x.criado_em).toISOString(), robo };
}

export async function apagarMensagem(conta: string, lead: string, id: number): Promise<boolean> {
  const r = await db()`delete from conversa_mensagens where conta_id = ${conta} and lead_id = ${lead} and id = ${id} returning id`;
  return r.length > 0;
}

export async function marcarPasso(conta: string, lead: string, passo: string, feito: boolean): Promise<void> {
  if (!passoPorId(passo)) return;
  if (feito) {
    await db()`
      insert into conversa_passos (conta_id, lead_id, passo) values (${conta}, ${lead}, ${passo})
      on conflict (conta_id, lead_id, passo) do nothing
    `;
  } else {
    await db()`delete from conversa_passos where conta_id = ${conta} and lead_id = ${lead} and passo = ${passo}`;
  }
}

// ------------------------------------------------------ lista de conversas

export interface ResumoConversa {
  leadId: string;
  mensagens: number;
  ultimaEm: string | null;
  ultimoAutor: 'eu' | 'cliente' | null;
  ultimoTexto: string | null;
  passos: number;
}

/** por lead: quantas falas, a última (de quem e o quê) e quantos passos do roteiro já foram */
export async function resumoDasConversas(conta: string): Promise<Map<string, ResumoConversa>> {
  const msgs = await db()`
    select lead_id, count(*)::int as n, max(criado_em) as ultima,
      (array_agg(autor order by criado_em desc, id desc))[1] as autor,
      (array_agg(texto order by criado_em desc, id desc))[1] as texto
    from conversa_mensagens where conta_id = ${conta}
    group by lead_id
  `;
  const passos = await db()`select lead_id, count(*)::int as n from conversa_passos where conta_id = ${conta} group by lead_id`;
  const mapa = new Map<string, ResumoConversa>();
  for (const m of msgs) {
    mapa.set(m.lead_id as string, {
      leadId: m.lead_id as string,
      mensagens: m.n as number,
      ultimaEm: m.ultima ? new Date(m.ultima).toISOString() : null,
      ultimoAutor: (m.autor as 'eu' | 'cliente') || null,
      ultimoTexto: ((m.texto as string) || '').slice(0, 160) || null,
      passos: 0,
    });
  }
  for (const p of passos) {
    const atual = mapa.get(p.lead_id as string);
    if (atual) atual.passos = p.n as number;
    else mapa.set(p.lead_id as string, { leadId: p.lead_id as string, mensagens: 0, ultimaEm: null, ultimoAutor: null, ultimoTexto: null, passos: p.n as number });
  }
  return mapa;
}

// ------------------------------------------------------ WhatsApp ligado

/** a conta que usa a conversa guiada (o primeiro e-mail de CONVERSA_EMAILS) */
export async function contaDaConversa(): Promise<string | null> {
  const email = (process.env.CONVERSA_EMAILS || 'vertionstack@gmail.com').split(',')[0].trim();
  const [r] = await db()`
    select m.conta_id from membros m
    where m.user_id = (select public.usuario_pelo_email(${email}))
    limit 1
  `;
  return (r?.conta_id as string) || null;
}

/** o lead desta conta com este celular (as formas vêm de variantesDoNumero) */
export async function leadPeloNumero(conta: string, formas: string[]): Promise<string | null> {
  if (!formas.length) return null;
  const [r] = await db()`
    select id from leads
    where conta_id = ${conta}
      and (regexp_replace(coalesce(whatsapp, ''), '\\D', '', 'g') = any(${formas})
        or regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = any(${formas}))
    order by updated_at desc
    limit 1
  `;
  return (r?.id as string) || null;
}
