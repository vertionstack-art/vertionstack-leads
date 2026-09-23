/**
 * Quanto um lead vale a sua próxima hora de trabalho.
 *
 * A lista bruta da extensão trata todo comércio igual, e não é. Uma
 * barbearia com 400 avaliações e o site fora do ar não é o mesmo lead que
 * um salão recém-aberto com três avaliações e nenhuma presença — o
 * primeiro tem caixa, tem urgência e já acredita em site; o segundo mal
 * sabe se vai existir no ano que vem.
 *
 * O peso maior não é a ausência de site: é **site quebrado**. Quem tem um
 * site fora do ar já pagou por um uma vez, ou seja, já está convencido do
 * produto, e hoje está perdendo cliente sem saber. Não há venda mais fácil
 * que essa. Quem nunca teve site pode simplesmente não querer, e aí a
 * conversa começa do zero.
 *
 * Os motivos não existem para enfeitar a tela: cada um é uma frase que se
 * usa na abordagem. "410 avaliações" é o argumento, não o enfeite.
 */

import type { Lead } from './db';
import { ramoDaCategoria } from './catalogo';

export type Nivel = 'quente' | 'morno' | 'frio';

export interface Temperatura {
  /** 0 a 100 */
  pontos: number;
  nivel: Nivel;
  rotulo: string;
  /** por que vale a pena — serve de argumento na conversa */
  motivos: string[];
  /** o que pesa contra, para você não perder tempo */
  freios: string[];
}

/**
 * Peso 1 — o que existe hoje de presença digital. Vale até 35.
 *
 * Site quebrado ganha de tudo. O dono está pagando hospedagem de algo que
 * não abre, ou tem uma tela vermelha de "site não seguro" espantando quem
 * chega pelo Google. É problema com data de hoje, e problema com data
 * vende; falta de site é problema sem data.
 */
function pesoPresenca(lead: Lead): { pontos: number; motivo: string | null } {
  switch (lead.siteStatus) {
    case 'fora_do_ar':
      return { pontos: 35, motivo: 'O site cadastrado não abre — e o dono provavelmente não sabe disso.' };
    case 'certificado_vencido':
      return { pontos: 33, motivo: 'O navegador mostra aviso vermelho antes de deixar entrar no site dele.' };
    case 'em_construcao':
      return { pontos: 29, motivo: 'O site existe mas está vazio: passa impressão de negócio fechado.' };
    case 'sem_https':
      return { pontos: 16, motivo: 'O site aparece como "não seguro" na barra do navegador.' };
    case 'virou_social':
      return { pontos: 25, motivo: 'O que está no Google como site leva para uma rede social.' };
  }

  switch (lead.websiteKind) {
    case 'marketplace':
      return { pontos: 26, motivo: 'Depende de plataforma de terceiro e paga comissão por cliente.' };
    case 'social':
      return { pontos: 24, motivo: 'Só tem rede social: audiência alugada, que some se a conta cair.' };
    case 'weak':
      return { pontos: 22, motivo: 'Usa construtor grátis — lento, com endereço esquisito e sem identidade.' };
    case 'none':
      return { pontos: 20, motivo: 'Não tem nenhum site: quem procura o serviço na região acha o concorrente.' };
  }

  return { pontos: 0, motivo: null };
}

/**
 * Peso 2 — movimento comprovado. Vale até 25.
 *
 * Avaliação é o único sinal de caixa que o Maps entrega. Quem juntou
 * centenas delas atende gente todo dia há anos, e tem de onde tirar
 * setecentos reais. Quem tem três, não tem — e site nenhum resolve isso.
 */
function pesoMovimento(n: number | null): { pontos: number; motivo: string | null; freio: string | null } {
  const r = n ?? 0;
  if (r >= 300) return { pontos: 25, motivo: `${r} avaliações no Google: movimento forte e caixa provável.`, freio: null };
  if (r >= 150) return { pontos: 22, motivo: `${r} avaliações: negócio estabelecido.`, freio: null };
  if (r >= 80) return { pontos: 18, motivo: `${r} avaliações: tem clientela formada.`, freio: null };
  if (r >= 30) return { pontos: 13, motivo: `${r} avaliações: movimento razoável.`, freio: null };
  if (r >= 10) return { pontos: 7, motivo: null, freio: null };
  if (r >= 3) return { pontos: 3, motivo: null, freio: 'Poucas avaliações — pode ser negócio novo ou parado.' };
  return { pontos: 0, motivo: null, freio: 'Quase sem avaliação: talvez nem esteja funcionando direito.' };
}

/**
 * Peso 3 — reputação. Vale até 15.
 *
 * Nota alta sem site é o melhor cenário que existe: o negócio é bom, as
 * pessoas gostam, e nada disso aparece para quem procura no Google. Já
 * nota baixa é freio, não trampolim — o problema dele não é o site, e
 * vender site para quem está perdendo cliente por atendimento ruim é
 * vender a coisa errada.
 */
function pesoReputacao(nota: number | null, avaliacoes: number | null): {
  pontos: number;
  motivo: string | null;
  freio: string | null;
} {
  if (nota === null) return { pontos: 2, motivo: null, freio: null };
  const n = nota.toFixed(1).replace('.', ',');

  /*
   * Nota sem volume não é reputação, é acaso: cinco estrelas dadas por
   * quatro pessoas costumam ser parentes. Sem pelo menos dez avaliações a
   * nota quase não pontua, senão comércio recém-aberto sobe na lista na
   * frente de quem tem trezentas avaliações e caixa de verdade.
   */
  if ((avaliacoes ?? 0) < 10) return { pontos: 3, motivo: null, freio: null };

  if (nota >= 4.7) return { pontos: 15, motivo: `${n} estrelas: reputação excelente que hoje não tem onde ser mostrada.`, freio: null };
  if (nota >= 4.3) return { pontos: 12, motivo: `${n} estrelas: boa reputação, pronta para usar no site.`, freio: null };
  if (nota >= 4.0) return { pontos: 8, motivo: null, freio: null };
  if (nota >= 3.5) return { pontos: 3, motivo: null, freio: null };

  // nota ruim só conta como freio quando há avaliação suficiente para significar algo
  return {
    pontos: 0,
    motivo: null,
    freio: (avaliacoes ?? 0) >= 10 ? `${n} estrelas: o problema dele é o atendimento, não o site.` : null,
  };
}

/**
 * Peso 4 — Instagram sem site. Vale até 12.
 *
 * Quem mantém Instagram já entende que presença digital traz cliente, já
 * gasta tempo com isso e não precisa ser convencido do começo. Falta só o
 * canal que é dele. É a conversa mais curta da lista.
 */
function pesoInstagram(lead: Lead): { pontos: number; motivo: string | null } {
  if (!lead.instagram) return { pontos: 0, motivo: null };
  if (lead.websiteKind === 'site') return { pontos: 5, motivo: null };
  return {
    pontos: 12,
    motivo: 'Cuida do Instagram mas não tem site próprio: já entende o valor, só falta o canal dele.',
  };
}

/** Peso 5 — ramos onde o que eu vendo resolve dor conhecida. Vale até 8. */
function pesoRamo(lead: Lead): { pontos: number; motivo: string | null } {
  const ramo = ramoDaCategoria(lead.category);
  switch (ramo) {
    case 'beleza':
    case 'saude':
    case 'fitness':
      return { pontos: 8, motivo: 'Ramo de agendamento: horário marcado sozinho é dor que o dono sente toda semana.' };
    case 'alimentacao':
      return { pontos: 7, motivo: 'Ramo de cardápio e pedido: o retorno aparece rápido e ele percebe.' };
    case 'servicos':
      return { pontos: 6, motivo: null };
    case 'imobiliario':
    case 'varejo':
    case 'turismo':
      return { pontos: 5, motivo: null };
    default:
      return { pontos: 3, motivo: null };
  }
}

const ROTULOS: Record<Nivel, string> = {
  quente: 'Quente',
  morno: 'Morno',
  frio: 'Frio',
};

export function temperaturaDoLead(lead: Lead): Temperatura {
  const motivos: string[] = [];
  const freios: string[] = [];

  const presenca = pesoPresenca(lead);
  const movimento = pesoMovimento(lead.reviews);
  const reputacao = pesoReputacao(lead.rating, lead.reviews);
  const insta = pesoInstagram(lead);
  const ramo = pesoRamo(lead);
  const contato = lead.phone ? 5 : 0;

  for (const m of [presenca.motivo, movimento.motivo, reputacao.motivo, insta.motivo, ramo.motivo]) {
    if (m) motivos.push(m);
  }
  for (const f of [movimento.freio, reputacao.freio]) {
    if (f) freios.push(f);
  }

  let pontos = presenca.pontos + movimento.pontos + reputacao.pontos + insta.pontos + ramo.pontos + contato;

  /*
   * Sem telefone o lead não é frio, é inalcançável: por melhor que seja o
   * negócio, não há por onde começar a conversa hoje. Corta pela metade em
   * vez de zerar, porque o número ainda pode ser achado no Instagram.
   */
  if (!lead.phone) {
    pontos = Math.round(pontos / 2);
    freios.push('Sem telefone cadastrado — procure o contato no Instagram antes.');
  }

  /*
   * Tem site próprio cadastrado — mas "cadastrado" e "funcionando" são
   * coisas diferentes, e a diferença vale muito.
   *
   * Com a verificação feita e o site de pé, falta a dor que sustenta a
   * conversa: o lead cai de verdade, senão comércio grande e bem resolvido
   * apareceria na frente de oportunidade real.
   *
   * Sem verificação, o que existe é desconhecimento, não boa notícia. O
   * endereço no Google pode estar morto há um ano. Aí o corte é leve e o
   * freio vira instrução: rode o Conferir sites antes de descartar. Foi
   * exatamente o caso de uma barbearia com 410 avaliações que apareceu
   * como fria só porque ninguém tinha conferido o site dela ainda.
   */
  if (presenca.pontos === 0) {
    if (lead.siteVerificadoEm) {
      pontos = Math.round(pontos * 0.55);
      freios.push('Site próprio conferido e no ar. Só aborde com uma observação concreta sobre o que falta nele.');
    } else {
      pontos = Math.round(pontos * 0.85);
      freios.push('Tem site cadastrado, mas ninguém conferiu ainda — rode o "Conferir sites" antes de descartar.');
    }
  }

  pontos = Math.max(0, Math.min(100, pontos));
  const nivel: Nivel = pontos >= 62 ? 'quente' : pontos >= 38 ? 'morno' : 'frio';

  return { pontos, nivel, rotulo: ROTULOS[nivel], motivos, freios };
}

/** classes de cor por nível, para a tabela e o cartão usarem o mesmo tom */
export const CLASSE_NIVEL: Record<Nivel, string> = {
  quente: 'bg-red-50 text-red-700 ring-red-200',
  morno: 'bg-amber-50 text-amber-800 ring-amber-200',
  frio: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
};
