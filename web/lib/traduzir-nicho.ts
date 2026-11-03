/**
 * O nicho digitado em português vira o termo que as pessoas usam no Google
 * Maps do país ("limpeza de piscina" → "pool cleaning" nos EUA).
 *
 * Primeiro olha a lista de nichos prontos (lib/exterior), depois o que já
 * foi traduzido antes (tabela traducoes_nicho) e só então pergunta à IA.
 * Se a IA não responder, a busca segue com o texto como foi digitado.
 */

import { db } from './sql';
import { NICHOS_EXTERIOR, paisExterior } from './exterior';
import { cabecaLigada, perguntarJson } from './cabeca';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function traduzirNicho(nicho: string, paisId: string): Promise<string> {
  const n = nicho.trim();
  const chave = semAcento(n);
  const pronto = NICHOS_EXTERIOR.find((x) => x.en === n.toLowerCase() || semAcento(x.pt) === chave);
  if (pronto) return pronto.en;

  const [ja] = await db()`select en from traducoes_nicho where pt = ${chave} and pais = ${paisId}`;
  if (ja) return ja.en as string;
  if (!cabecaLigada()) return n;

  const pais = paisExterior(paisId)?.nome ?? paisId;
  try {
    const r = await perguntarJson<{ en: string }>(
      'You translate a type of local business, written by a Brazilian, into the short search term people in the given country type into Google Maps to find that business. Use the local word (UK: "hairdresser", US: "hair salon"). If the text is already in English, return it cleaned up. Lowercase, 1 to 4 words, no city, no quotes. Return JSON {"en": "..."}.',
      `Country: ${pais}\nBusiness type: ${n}`,
      { type: 'object', properties: { en: { type: 'string' } }, required: ['en'] },
    );
    const en = String(r.dados.en || '')
      .toLowerCase()
      .replace(/["'.]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
    if (!/^[a-z0-9 &-]{2,50}$/.test(en)) return n;
    await db()`insert into traducoes_nicho (pt, pais, en) values (${chave}, ${paisId}, ${en}) on conflict (pt, pais) do nothing`;
    return en;
  } catch {
    return n;
  }
}
