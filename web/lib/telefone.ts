/**
 * Telefone brasileiro: é celular ou fixo, e qual número abrir no WhatsApp.
 *
 * Celular tem 11 dígitos com o 9 logo depois do DDD: (21) 98765-4321.
 * Fixo tem 10: (21) 3456-7890. É pela forma, sem consultar nada — o que não
 * garante que o celular tenha WhatsApp, mas separa o que certamente não tem.
 */

export type TipoTelefone = 'celular' | 'fixo';

/** só os dígitos do número nacional (DDD + número), sem o 55 e sem o 0 de operadora */
export function digitosNacionais(bruto: string | null | undefined): string | null {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1); // 0 + DDD + fixo
  if (d.length === 12 && d.startsWith('0')) d = d.slice(1); // 0 + DDD + celular
  return d.length === 10 || d.length === 11 ? d : null;
}

export function tipoDoTelefone(bruto: string | null | undefined): TipoTelefone | null {
  const d = digitosNacionais(bruto);
  if (!d) return null;
  if (d.length === 11 && d[2] === '9') return 'celular';
  if (d.length === 10 && /[2-5]/.test(d[2])) return 'fixo';
  // 10 dígitos começando com 6-9 é celular antigo, sem o 9 na frente
  if (d.length === 10 && /[6-9]/.test(d[2])) return 'celular';
  return null;
}

/** o número no formato do wa.me (55 + DDD + número), ou null se não serve */
export function numeroWhatsapp(bruto: string | null | undefined): string | null {
  const d = digitosNacionais(bruto);
  if (!d) return null;
  // celular antigo de 8 dígitos ganha o 9 que o WhatsApp exige
  const n = d.length === 10 && /[6-9]/.test(d[2]) ? d.slice(0, 2) + '9' + d.slice(2) : d;
  return n.length === 11 && n[2] === '9' ? '55' + n : null;
}

/** acha números de WhatsApp em links wa.me / api.whatsapp.com dentro de um texto ou HTML */
export function whatsappsNoTexto(texto: string): string[] {
  const achados = new Set<string>();
  const re = /(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^"'\s<>]*?&(?:amp;)?)?phone=|api\.whatsapp\.com\/send\?(?:[^"'\s<>]*?&(?:amp;)?)?phone=)\+?(\d{10,13})/gi;
  for (const m of texto.matchAll(re)) {
    const d = m[1];
    const n = d.startsWith('55') ? d : '55' + d;
    if (n.length >= 12 && n.length <= 13) achados.add(n);
  }
  return [...achados];
}

/** (21) 98765-4321 a partir de 5521987654321 */
export function formatarWhatsapp(n: string): string {
  const d = n.startsWith('55') ? n.slice(2) : n;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
