/**
 * E-mail de comércio: validar o que alguém digitou ou achar o que está
 * escrito no site/Linktree dele. Descarta os falsos que aparecem em quase
 * toda página (exemplo@, e-mail de plataforma, nome de arquivo de imagem).
 */

const FORMATO = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;

const LIXO = /(^|\.)(sentry|wixpress|wix|example|exemplo|domain|dominio|seudominio|email|godaddy|squarespace|wordpress|cloudflare|linktr|linktree|beacons|amazonaws|googleusercontent)\.|^(nome|seu|seuemail|email|exemplo|teste|user|usuario|name|your|youremail|noreply|no-reply|nao-responda)@|\.(png|jpe?g|gif|webp|svg|css|js)$/i;

export function emailValido(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
  return s && s.length <= 120 && FORMATO.test(s) && !LIXO.test(s) ? s : null;
}

/** o primeiro e-mail que parece ser do comércio, num pedaço de HTML ou texto */
export function emailNoTexto(texto: string): string | null {
  const achados = [
    ...Array.from(texto.matchAll(/mailto:([^"'?\s>]+)/gi), (m) => m[1]),
    ...(texto.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) || []),
  ];
  for (const a of achados) {
    const ok = emailValido(decodeURIComponent(a));
    if (ok) return ok;
  }
  return null;
}
