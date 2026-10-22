/**
 * O WhatsApp da Vertion ligado à ferramenta pela Evolution API (v2), que roda
 * num servidor próprio sempre ligado (a Vercel não segura uma conexão aberta).
 *
 * Regra combinada com o dono: toda mensagem sai pelo clique dele. Nada aqui
 * envia sozinho, em fila ou em horário marcado. As respostas dos leads chegam
 * pelo webhook (app/api/whatsapp/webhook) e entram na conversa guiada.
 *
 * Variáveis na Vercel (só servidor):
 *   EVOLUTION_URL               endereço do servidor da Evolution (https://...)
 *   EVOLUTION_API_KEY           a chave global (AUTHENTICATION_API_KEY do servidor)
 *   EVOLUTION_INSTANCIA         nome da conexão, ex.: vertion
 *   EVOLUTION_SEGREDO_WEBHOOK   texto aleatório longo que o webhook confere
 *
 * Rotas e formatos conferidos no código da Evolution API 2.3.7.
 */

import { timingSafeEqual } from 'node:crypto';

export function evolutionLigada(): boolean {
  return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCIA);
}

function base(): string {
  return (process.env.EVOLUTION_URL || '').replace(/\/$/, '');
}

function instancia(): string {
  return encodeURIComponent(process.env.EVOLUTION_INSTANCIA || 'vertion');
}

export class ErroEvolution extends Error {
  constructor(msg: string, public status: number) {
    super(msg);
  }
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  if (!evolutionLigada()) throw new ErroEvolution('O WhatsApp ainda não foi ligado (falta configurar a Evolution API na Vercel).', 503);
  let r: Response;
  try {
    r = await fetch(base() + caminho, {
      method: metodo,
      headers: { apikey: process.env.EVOLUTION_API_KEY || '', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    throw new ErroEvolution('O servidor do WhatsApp não respondeu. Ele está ligado?', 502);
  }
  const texto = await r.text();
  let j: unknown = null;
  try {
    j = texto ? JSON.parse(texto) : null;
  } catch {
    // resposta que não é JSON: fica o texto no erro abaixo
  }
  if (!r.ok) {
    const msg = (j as { response?: { message?: unknown }; message?: unknown } | null)?.response?.message ?? (j as { message?: unknown } | null)?.message ?? texto;
    console.error('[evolution]', metodo, caminho, r.status, String(msg).slice(0, 300));
    if (r.status === 401 || r.status === 403) throw new ErroEvolution('A chave da Evolution API foi recusada. Confira EVOLUTION_API_KEY.', 503);
    throw new ErroEvolution('O WhatsApp recusou o pedido. Tente de novo.', 502);
  }
  return j as T;
}

// ------------------------------------------------------------- conexão

export type EstadoWhatsapp = 'open' | 'connecting' | 'close' | 'inexistente' | 'desligado';

export async function estadoDoWhatsapp(): Promise<EstadoWhatsapp> {
  if (!evolutionLigada()) return 'desligado';
  try {
    const j = await chamar<{ instance?: { state?: string } }>('GET', `/instance/connectionState/${instancia()}`);
    const s = j?.instance?.state;
    return s === 'open' || s === 'connecting' || s === 'close' ? s : 'close';
  } catch (e) {
    if (e instanceof ErroEvolution && e.status === 502) return 'inexistente';
    throw e;
  }
}

/** cria a conexão se ainda não existe, liga o webhook e devolve o QR code para ler no celular */
export async function conectarWhatsapp(urlDoWebhook: string): Promise<{ estado: EstadoWhatsapp; qr: string | null; codigo: string | null }> {
  let estado = await estadoDoWhatsapp();
  if (estado === 'inexistente') {
    await chamar('POST', '/instance/create', {
      instanceName: decodeURIComponent(instancia()),
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    estado = 'close';
  }
  await ligarWebhook(urlDoWebhook);
  if (estado === 'open') return { estado, qr: null, codigo: null };
  const j = await chamar<{ base64?: string; pairingCode?: string; qrcode?: { base64?: string; pairingCode?: string } }>(
    'GET',
    `/instance/connect/${instancia()}`,
  );
  const qr = j?.base64 || j?.qrcode?.base64 || null;
  return { estado: 'connecting', qr: qr && qr.startsWith('data:image/') ? qr : null, codigo: j?.pairingCode || j?.qrcode?.pairingCode || null };
}

export async function desconectarWhatsapp(): Promise<void> {
  await chamar('DELETE', `/instance/logout/${instancia()}`);
}

/** o webhook manda as mensagens novas para a ferramenta, com o segredo num cabeçalho */
async function ligarWebhook(url: string): Promise<void> {
  const segredo = process.env.EVOLUTION_SEGREDO_WEBHOOK;
  if (!segredo || segredo.length < 24) throw new ErroEvolution('Falta EVOLUTION_SEGREDO_WEBHOOK (um texto aleatório longo) na Vercel.', 503);
  await chamar('POST', `/webhook/set/${instancia()}`, {
    webhook: {
      enabled: true,
      url,
      headers: { 'x-vertion-segredo': segredo },
      byEvents: false,
      base64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
  });
}

export function segredoDoWebhookConfere(recebido: string | null): boolean {
  const certo = process.env.EVOLUTION_SEGREDO_WEBHOOK || '';
  if (!certo || !recebido) return false;
  const a = Buffer.from(certo);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

// -------------------------------------------------------------- envio

/** envia um texto; chamado só a partir do clique da pessoa (api/conversa/[id]/enviar) */
export async function enviarTexto(numero: string, texto: string): Promise<{ id: string | null }> {
  const j = await chamar<{ key?: { id?: string } }>('POST', `/message/sendText/${instancia()}`, {
    number: numero.replace(/\D/g, ''),
    text: texto,
    linkPreview: true,
  });
  return { id: j?.key?.id || null };
}

// ------------------------------------------------------- mensagens recebidas

export interface MensagemRecebida {
  id: string;
  numero: string;
  deMim: boolean;
  texto: string;
  nome: string | null;
}

/** o que interessa do evento messages.upsert: só conversa individual com texto (ou legenda) */
export function lerMensagemRecebida(evento: unknown): MensagemRecebida | null {
  const e = evento as { event?: string; data?: Record<string, unknown> };
  if (!e || String(e.event || '').toLowerCase().replace(/_/g, '.') !== 'messages.upsert') return null;
  const d = (e.data || {}) as {
    key?: { id?: string; remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; senderPn?: string };
    pushName?: string;
    message?: Record<string, { text?: string; caption?: string } | string | undefined>;
  };
  const key = d.key || {};
  // o WhatsApp novo às vezes manda um "lid" no lugar do número; aí o número vem em remoteJidAlt/senderPn
  const jid = [key.remoteJid, key.remoteJidAlt, key.senderPn].find((j) => typeof j === 'string' && j.endsWith('@s.whatsapp.net'));
  if (!key.id || !jid) return null;
  const m = d.message || {};
  const texto =
    (typeof m.conversation === 'string' ? m.conversation : '') ||
    (m.extendedTextMessage as { text?: string } | undefined)?.text ||
    (m.imageMessage as { caption?: string } | undefined)?.caption ||
    (m.videoMessage as { caption?: string } | undefined)?.caption ||
    (m.documentMessage as { caption?: string } | undefined)?.caption ||
    (m.audioMessage ? '[áudio]' : '') ||
    (m.imageMessage ? '[imagem]' : '') ||
    (m.videoMessage ? '[vídeo]' : '') ||
    (m.documentMessage ? '[documento]' : '') ||
    (m.stickerMessage ? '[figurinha]' : '');
  if (!texto) return null;
  return {
    id: key.id,
    numero: jid.split('@')[0].replace(/\D/g, ''),
    deMim: Boolean(key.fromMe),
    texto: texto.slice(0, 2000),
    nome: typeof d.pushName === 'string' ? d.pushName.slice(0, 80) : null,
  };
}

/**
 * Formas do mesmo celular brasileiro: com e sem 55, com e sem o 9 depois do
 * DDD (o WhatsApp às vezes entrega o número antigo, sem o 9).
 */
export function variantesDoNumero(numero: string): string[] {
  let d = numero.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  const formas = new Set<string>();
  if (d.length === 11 && d[2] === '9') {
    formas.add(d);
    formas.add(d.slice(0, 2) + d.slice(3));
  } else if (d.length === 10) {
    formas.add(d);
    formas.add(d.slice(0, 2) + '9' + d.slice(2));
  } else if (d) {
    formas.add(d);
  }
  return [...formas].flatMap((x) => [x, '55' + x]);
}
