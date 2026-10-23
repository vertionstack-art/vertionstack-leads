/**
 * Reconhece a resposta automática do WhatsApp Business (boas-vindas,
 * ausência, menu "digite 1 para..."): não é uma pessoa respondendo. O robô
 * não responde o conteúdo dela (não agenda, não escolhe opção de menu que
 * não leve a uma pessoa); pede para falar com quem cuida da parte digital ou
 * com o dono. Roda no navegador e no servidor.
 *
 * Duas pistas:
 * - o tempo: texto comprido que chega poucos segundos depois da nossa
 *   mensagem (ninguém lê e responde em 2 s; a da Dra. Débora chegou em 2 s);
 * - o jeito do texto: boas-vindas, "obrigado pelo contato", "retornaremos",
 *   menu numerado, horário de atendimento, "mensagem automática".
 */

const SINAIS: RegExp[] = [
  /seja\s+(muito\s+)?bem[-\s]?vind[oa]/i,
  /obrigad[oa]\s+(por|pelo)\s+(o\s+|seu\s+|sua\s+|entrar\s+em\s+)?(contato|mensagem)/i,
  /agradecemos\s+(o\s+|seu\s+|sua\s+|pelo\s+|pela\s+)?(contato|mensagem|prefer[êe]ncia)/i,
  /(mensagem|resposta|atendimento)\s+autom[áa]tic[oa]/i,
  /(retornaremos|responderemos|entraremos\s+em\s+contato|retorno\s+em\s+breve|em\s+breve\s+(um|uma|nossa|nosso|te|lhe|retornamos|respondemos))/i,
  /(nosso|nossos)\s+hor[áa]rios?\s+de\s+(atendimento|funcionamento)|fora\s+do\s+(nosso\s+)?hor[áa]rio|hor[áa]rio\s+de\s+atendimento\s*[:\-]/i,
  /no\s+momento\s+(n[ãa]o\s+)?(estamos|podemos|conseguimos)\s+(dispon[íi]ve(l|is)|atender|responder)/i,
  /(digite|responda|escolha|selecione|envie|tecle)\s+(com\s+)?(o\s+|a\s+)?(n[úu]mero|op[çc][ãa]o|uma\s+das|\d)/i,
  /[1-9]️?⃣/, // 1️⃣ 2️⃣
  /n[ãa]o\s+precisa\s+aguardar|aguarde\s+(que\s+)?(em\s+breve|um\s+momento|nosso)/i,
  /(como|em\s+que)\s+(podemos|posso)\s+(te\s+|lhe\s+)?ajudar[^.?!]*\?[\s\S]*\n/i,
];

/** menu numerado em linhas: "1 - Agendar" / "2) Valores" */
const MENU = /(^|\n)\s*1\s*[-–).:]\s*\S[^\n]*\n\s*2\s*[-–).:]\s*\S/;

/**
 * `segundos` = quanto tempo depois da nossa última mensagem ela chegou
 * (null quando não se sabe). Resposta comprida em até 8 s é automática.
 */
export function ehAutomatica(texto: string, segundos?: number | null): boolean {
  const t = String(texto || '');
  if (segundos != null && segundos >= 0 && segundos <= 8 && t.length >= 40) return true;
  if (MENU.test(t)) return true;
  const sinais = SINAIS.filter((r) => r.test(t)).length;
  // textão de boas-vindas costuma ter vários sinais; um só basta se o texto for longo
  return sinais >= 2 || (sinais === 1 && t.length >= 120);
}

/** para listas: a mensagem do cliente e a nossa anterior, com as datas */
export function segundosDepois(dela: string, nossaAnterior: string | null | undefined): number | null {
  if (!nossaAnterior) return null;
  const s = (new Date(dela).getTime() - new Date(nossaAnterior).getTime()) / 1000;
  return Number.isFinite(s) ? s : null;
}
