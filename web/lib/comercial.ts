/**
 * O cérebro comercial, a parte sem IA: lê os dados do lead, a leitura do
 * site e a conversa, e monta a "ficha comercial" que vai para a IA (e para a
 * tela). Três gavetas que nunca se misturam:
 *
 * - fatos: o que foi observado (Google, verificação e leitura do site,
 *   conversa). Pode ser dito ao cliente.
 * - oportunidades: hipóteses de serviço que combinam com a situação. A IA
 *   precisa perguntar ou confirmar antes de afirmar.
 * - não sabemos: o que falta e pode ser perguntado.
 *
 * Mais o estágio da conversa e a situação de follow-up, calculados aqui
 * para a IA não ter de adivinhar (e não mandar apresentação para quem já
 * pediu proposta). Roda no navegador e no servidor.
 */

import type { LeituraSite } from './leitura-site';

export type IdEstagio =
  | 'sem_contato'
  | 'aguardando_resposta'
  | 'conversa_iniciada'
  | 'descoberta'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'sem_interesse'
  | 'pediu_parar'
  | 'retorno_combinado';

export const ESTAGIOS: Record<IdEstagio, { rotulo: string; objetivo: string }> = {
  sem_contato: { rotulo: 'Ainda sem contato', objetivo: 'Abrir a conversa com um motivo real e uma pergunta fácil. Não vender tudo de uma vez.' },
  aguardando_resposta: { rotulo: 'Esperando resposta', objetivo: 'Só retomar se fizer sentido, com um motivo novo ou uma pergunta melhor. Nada de "viu minha mensagem?".' },
  conversa_iniciada: { rotulo: 'Conversa começou', objetivo: 'Responder o que ele disse e entender quem é e o que precisa. Uma pergunta por vez.' },
  descoberta: { rotulo: 'Entendendo a necessidade', objetivo: 'Descobrir como os clientes chegam hoje, o que incomoda e quem decide, sem interrogatório. Depois ligar a necessidade ao serviço certo.' },
  proposta: { rotulo: 'Proposta na mesa', objetivo: 'Tirar dúvidas da proposta e combinar o próximo passo. Não recomeçar a apresentação.' },
  negociacao: { rotulo: 'Negociando', objetivo: 'Entender o que pesa na decisão e responder com o que é confirmado. Condição nova é com o vendedor.' },
  fechado: { rotulo: 'Fechado', objetivo: 'Combinar os próximos passos do projeto. Nada de vender de novo.' },
  sem_interesse: { rotulo: 'Disse que não tem interesse', objetivo: 'Respeitar. No máximo um agradecimento curto, deixando a porta aberta sem insistir.' },
  pediu_parar: { rotulo: 'Pediu para não ser contatado', objetivo: 'Não mandar mais nada de venda.' },
  retorno_combinado: { rotulo: 'Retorno combinado', objetivo: 'Voltar na data combinada, lembrando do que foi conversado.' },
};

/**
 * Os serviços que o vendedor oferece e quando cada um faz sentido. A ficha
 * aponta os que combinam com o lead; a IA escolhe UM caminho por vez.
 */
export const SERVICOS = {
  site: 'Site institucional: para quem não tem site, tem site que não abre, ou só tem rede social/Linktree. Apresenta os serviços e facilita o contato.',
  melhoria: 'Melhorar o site que já existe: para site no ar com algum ponto fraco observado (sem HTTPS, sem caminho claro de contato, inacabado). Não é refazer do zero.',
  landing: 'Landing page: uma página para uma oferta ou campanha específica. Faz sentido para quem anuncia ou tem um serviço carro-chefe, mesmo com site bom.',
  captacao: 'Captação de contatos: formulário, botão de WhatsApp e chamadas claras para o visitante virar conversa.',
  agendamento: 'Agendamento: marcar horário com menos troca de mensagem. Faz sentido para clínica, consultório, salão, barbearia, estética, pet, aulas.',
  orcamento: 'Pedidos de orçamento organizados: o pedido chega com as informações certas, sem ida e volta.',
  automacao: 'Automação de atendimento e integração com WhatsApp: respostas iniciais, triagem e encaminhamento, para quem recebe muita mensagem.',
} as const;
export type IdServico = keyof typeof SERVICOS;

export interface Oportunidade {
  servico: IdServico;
  /** por que pode fazer sentido, apoiado em fato observado */
  motivo: string;
}

export interface FichaComercial {
  estagio: IdEstagio;
  /**
   * Quem começou a conversa. Na prospecção fomos NÓS que procuramos o lead:
   * quando a atendente pergunta "no que posso te ajudar?", a resposta é o
   * motivo do nosso contato, nunca "como posso ajudar vocês?" (caso real da
   * Casa Magenta, 23/10/2026). motivo = a nossa primeira mensagem.
   */
  contato: { quemProcurou: 'nos' | 'ele' | null; motivo: string | null; perguntouAssunto: boolean };
  fatos: string[];
  oportunidades: Oportunidade[];
  naoSabemos: string[];
  followUp: {
    /** dias desde a nossa última mensagem (null = nunca mandamos) */
    diasDesdeNossa: number | null;
    /** mensagens nossas seguidas desde a última resposta do cliente */
    semResposta: number;
    /** recomendação objetiva */
    recomendacao: string;
    podeMandar: boolean;
  };
}

/** o que a ficha precisa do lead (subconjunto de Lead, para rodar também nos testes) */
export interface LeadComercial {
  nome: string;
  tipo: 'comercio' | 'pessoa';
  ramo: string | null;
  cidade: string | null;
  status: string;
  websiteKind: string;
  website: string | null;
  siteStatus: string | null;
  siteDetalhe: string | null;
  rating: number | null;
  reviews: number | null;
  instagram: boolean;
  /** true = sem tag de anúncio; false = anuncia; null = não conferido */
  semAnuncio: boolean | null;
  chamouPrimeiro: boolean;
  interesse: string[];
  ideia: string | null;
  /** serviços reais e diferenciais que o vendedor anotou (briefing) */
  briefing: string | null;
  notas: string | null;
  temPrevia: boolean;
  temProposta: boolean;
  propostaAberturas: number;
  lembreteEm: string | null;
  lembreteTexto: string | null;
}

export interface FalaComercial {
  autor: 'eu' | 'cliente';
  texto: string;
  /** ISO */
  em: string;
  automatica?: boolean;
}

const RAMO_COM_HORARIO = /cl[íi]nic|consult[óo]rio|odont|dent|m[ée]dic|psic|fisio|nutri|est[ée]tic|sal[ãa]o|cabel|barb|manicure|unha|spa|massag|pet|veterin|banho e tosa|academia|personal|aula|escola|curso|pilates|yoga|tatu|fono|terap|derma|podolog/i;
const RAMO_COM_ORCAMENTO = /constru|reform|engenh|arquit|marcen|serralh|vidra|el[ée]tric|hidr[áa]ul|pintur|gesso|drywall|ar[\s-]?condicionado|refriger|mudan|frete|transport|gr[áa]fica|evento|buffet|decora|m[óo]ve|planejad|instala|manuten|dedetiz|limpeza|seguro|contab|advoc|jur[íi]d|despachante|imobili|corretor/i;

/** pedido explícito para parar: vale como trava, a IA nunca passa por cima */
export const PEDIU_PARAR = /(n[ãa]o\s+(me\s+)?(mande|mandem|envie|chame|ligue|procure)\s+mais|pa(re|ra)\s+de\s+(me\s+)?(mandar|enviar|chamar|ligar)|me\s+(tira|tire|remova|exclua)|(remove|tira|exclui)\s+(meu|o meu)\s+n[úu]mero|sair\s+da\s+lista|n[ãa]o\s+quero\s+(mais\s+)?(receber|ser\s+contatad)|denunciar|bloquear\s+(voc|seu))/i;
/** recusa clara (respeitar, sem insistir); diferente de "agora não" */
export const SEM_INTERESSE = /(n[ãa]o\s+(tenho|temos|tem)\s+(nenhum\s+)?interesse|sem\s+interesse|n[ãa]o\s+(me\s+)?interessa|n[ãa]o\s+(precisamos|preciso)\s+(disso|de\s+site|de\s+nada)|j[áa]\s+resolvemos|obrigad[oa],?\s+mas\s+n[ãa]o)/i;

const dias = (de: string, ate = Date.now()) => Math.max(0, Math.floor((ate - new Date(de).getTime()) / 86_400_000));

export function estagioDoLead(l: LeadComercial, conversa: FalaComercial[], agora = Date.now()): IdEstagio {
  const doCliente = conversa.filter((m) => m.autor === 'cliente' && !m.automatica);
  if (doCliente.some((m) => PEDIU_PARAR.test(m.texto))) return 'pediu_parar';
  if (l.status === 'fechado') return 'fechado';
  const ultimaDele = doCliente[doCliente.length - 1];
  if (ultimaDele && SEM_INTERESSE.test(ultimaDele.texto)) return 'sem_interesse';
  if (l.lembreteEm && new Date(l.lembreteEm).getTime() > agora - 86_400_000) return 'retorno_combinado';
  if (l.status === 'negociando') return 'negociacao';
  if (l.temProposta && (l.propostaAberturas > 0 || conversa.some((m) => m.autor === 'eu' && /\/p\/|proposta/i.test(m.texto)))) return 'proposta';
  if (!conversa.length) return 'sem_contato';
  if (!doCliente.length) return 'aguardando_resposta';
  return doCliente.length >= 3 ? 'descoberta' : 'conversa_iniciada';
}

function oportunidadesDe(l: LeadComercial, s: LeituraSite | null): Oportunidade[] {
  const o: Oportunidade[] = [];
  const ramo = `${l.ramo || ''} ${l.briefing || ''}`;
  if (l.chamouPrimeiro || l.tipo === 'pessoa') {
    // quem chamou ou é pessoa: o interesse que ele declarou manda
    if (l.interesse.length) o.push({ servico: 'site', motivo: `Ele disse que quer: ${l.interesse.join(', ')}.` });
    return o;
  }
  const ks = l.websiteKind;
  const st = l.siteStatus || '';
  if (ks === 'none') o.push({ servico: 'site', motivo: 'Não tem site cadastrado no Google: quem pesquisa só acha o endereço e o telefone.' });
  else if (ks === 'social' || st === 'virou_social') o.push({ servico: 'site', motivo: 'O "site" no Google leva para rede social ou página de links, não para um site próprio.' });
  else if (['fora_do_ar', 'nao_encontrado', 'certificado_vencido'].includes(st)) o.push({ servico: 'site', motivo: `O site cadastrado no Google tem problema: ${l.siteDetalhe || 'não abre'}.` });
  else if (st === 'em_construcao') o.push({ servico: 'melhoria', motivo: 'O site está inacabado ou vazio (página de "em breve"/em construção).' });
  else if (st === 'sem_https') o.push({ servico: 'melhoria', motivo: 'O site abre sem HTTPS: o navegador mostra "não seguro".' });

  if (s?.lido && ks === 'site' && st !== 'em_construcao') {
    if (!s.formulario && !s.whatsapp) o.push({ servico: 'captacao', motivo: 'Não dá para afirmar que falta: só não achei formulário nem botão de WhatsApp no código da página inicial (pode existir). Use para perguntar como o visitante entra em contato.' });
    if (RAMO_COM_HORARIO.test(ramo) && !s.agendamento) o.push({ servico: 'agendamento', motivo: 'O ramo trabalha com horário marcado e a página inicial não fala em agendar (não afirme que falta: pergunte como marcam).' });
    if (s.orcamento || RAMO_COM_ORCAMENTO.test(ramo)) o.push({ servico: 'orcamento', motivo: s.orcamento ? 'O site pede para o visitante solicitar orçamento.' : 'O ramo vende por orçamento.' });
    if (!s.celular) o.push({ servico: 'melhoria', motivo: 'O HTML não tem a etiqueta de celular (viewport): a página pode abrir pequena no celular. Confirme abrindo no celular.' });
    if (s.whatsapp && (s.formulario || s.agendamento)) o.push({ servico: 'automacao', motivo: 'Já recebe contato por WhatsApp e formulário: dá para organizar o atendimento inicial.' });
  } else if (ks === 'none' && RAMO_COM_HORARIO.test(ramo)) {
    o.push({ servico: 'agendamento', motivo: 'O ramo trabalha com horário marcado.' });
  }
  if (l.semAnuncio === false) o.push({ servico: 'landing', motivo: 'O site tem tag de anúncio: provavelmente anuncia, e campanha rende mais com página própria.' });

  // um serviço aparece uma vez, com o primeiro motivo
  return o.filter((x, i, a) => a.findIndex((y) => y.servico === x.servico) === i).slice(0, 4);
}

function fatosDe(l: LeadComercial, s: LeituraSite | null, conversa: FalaComercial[]): string[] {
  const f: string[] = [];
  if (l.ramo) f.push(`Ramo: ${l.ramo}${l.cidade ? ` (cidade: ${l.cidade})` : ''}.`);
  if (l.chamouPrimeiro) f.push('Foi ele quem chamou a Vertion no WhatsApp (veio do Instagram, do site ou de indicação).');
  if (l.rating && l.reviews) f.push(`Google: nota ${l.rating.toFixed(1).replace('.', ',')} com ${l.reviews} avaliações.`);
  if (l.instagram) f.push('Tem Instagram.');
  if (l.websiteKind === 'site' && l.siteStatus === 'ok') f.push('O site está no ar e funcionando.');
  if (s?.lido) {
    if (s.titulo) f.push(`Título do site: "${s.titulo}".`);
    if (s.descricao) f.push(`O site se descreve assim: "${s.descricao}".`);
    if (s.assuntos.length) f.push(`Assuntos da página inicial: ${s.assuntos.slice(0, 6).join(' | ')}.`);
    const tem = [s.formulario && 'formulário', s.whatsapp && 'botão/link de WhatsApp', s.telefoneClicavel && 'telefone clicável', s.agendamento && 'menção a agendamento', s.orcamento && 'pedido de orçamento'].filter(Boolean);
    if (tem.length) f.push(`O site tem: ${tem.join(', ')}.`);
  }
  if (l.briefing) f.push(`Anotado pelo vendedor: ${l.briefing.slice(0, 400)}`);
  if (l.ideia) f.push(`Ideia que o cliente contou: ${l.ideia.slice(0, 300)}`);
  if (l.interesse.length) f.push(`O que ele disse que quer: ${l.interesse.join(', ')}.`);
  if (l.notas) f.push(`Notas do vendedor: ${l.notas.slice(0, 300)}`);
  if (l.temPrevia) f.push('Já existe uma prévia de site pronta para ele.');
  if (l.temProposta) f.push(l.propostaAberturas > 0 ? `Já tem proposta, e ele abriu o link ${l.propostaAberturas} ${l.propostaAberturas === 1 ? 'vez' : 'vezes'}.` : 'Já tem proposta montada (não há registro de que ele abriu).');
  if (l.lembreteEm) f.push(`Retorno combinado para ${new Date(l.lembreteEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${l.lembreteTexto ? `: ${l.lembreteTexto}` : ''}.`);
  if (conversa.some((m) => m.automatica)) f.push('A empresa tem resposta automática do WhatsApp Business.');
  return f;
}

function naoSabemosDe(l: LeadComercial, s: LeituraSite | null, conversa: FalaComercial[]): string[] {
  const n: string[] = [];
  const falou = conversa.filter((m) => m.autor === 'cliente' && !m.automatica).map((m) => m.texto).join(' ').toLowerCase();
  if (!/dono|respons[áa]vel|s[óo]cio|eu mesm|sou eu|propriet/.test(falou)) n.push('Se estamos falando com quem decide.');
  if (!/cliente|chega|indica[çc]|instagram|google|boca a boca|an[úu]ncio/.test(falou)) n.push('Como os clientes chegam hoje.');
  if (l.websiteKind === 'site' && s && !s.lido) n.push('Como está o site por dentro (não deu para ler a página: isso NÃO é defeito).');
  if (!l.interesse.length && !l.ideia) n.push('O que ele mesmo acha que precisa.');
  return n.slice(0, 3);
}

function followUpDe(conversa: FalaComercial[], estagio: IdEstagio, agora = Date.now()): FichaComercial['followUp'] {
  const nossas = conversa.filter((m) => m.autor === 'eu');
  const ultimaNossa = nossas[nossas.length - 1];
  let semResposta = 0;
  for (let i = conversa.length - 1; i >= 0; i--) {
    const m = conversa[i];
    if (m.autor === 'cliente' && !m.automatica) break;
    if (m.autor === 'eu') semResposta++;
  }
  const diasDesdeNossa = ultimaNossa ? dias(ultimaNossa.em, agora) : null;
  if (estagio === 'pediu_parar') return { diasDesdeNossa, semResposta, podeMandar: false, recomendacao: 'Ele pediu para não ser mais contatado. Não mande nada de venda.' };
  if (estagio === 'sem_interesse') return { diasDesdeNossa, semResposta, podeMandar: semResposta === 0, recomendacao: 'Disse que não tem interesse: no máximo um agradecimento curto, sem insistir.' };
  if (estagio === 'fechado') return { diasDesdeNossa, semResposta, podeMandar: true, recomendacao: 'Cliente fechado: só falar do projeto.' };
  if (!ultimaNossa) return { diasDesdeNossa, semResposta, podeMandar: true, recomendacao: 'Ainda não mandamos nada.' };
  const ultima = conversa[conversa.length - 1];
  if (ultima?.autor === 'cliente' && !ultima.automatica) return { diasDesdeNossa, semResposta: 0, podeMandar: true, recomendacao: 'A última mensagem é dele: responder, não é follow-up.' };
  if (semResposta >= 3) return { diasDesdeNossa, semResposta, podeMandar: false, recomendacao: `Já são ${semResposta} mensagens nossas sem resposta. Melhor parar; se mandar, que seja uma última, curta e sem cobrança.` };
  if (diasDesdeNossa !== null && diasDesdeNossa < 2) return { diasDesdeNossa, semResposta, podeMandar: false, recomendacao: `A última mensagem saiu há ${diasDesdeNossa === 0 ? 'menos de um dia' : '1 dia'}. Espere pelo menos 2 a 3 dias antes de retomar.` };
  return { diasDesdeNossa, semResposta, podeMandar: true, recomendacao: `Sem resposta há ${diasDesdeNossa} dias (${semResposta} ${semResposta === 1 ? 'mensagem nossa' : 'mensagens nossas'} seguidas). Dá para retomar com um motivo novo.` };
}

/** "no que posso te ajudar?", "pois não?", "do que se trata?", "quem fala?" */
export const PERGUNTOU_ASSUNTO = /(n[oa] que|em que|como) (eu )?(posso|podemos|poderia|poder[íi]amos) (te |lhe |o |a )?(ajudar|ser [úu]til)|pois n[ãa]o|do que se trata|qual (seria |é )?o assunto|quem (fala|[ée] voc[êe]|est[áa] falando)|sobre o que (seria|[ée])|pode (me )?(dizer|falar) do que se trata|em que posso ser [úu]til/i;

function contatoDe(l: LeadComercial, conversa: FalaComercial[]): FichaComercial['contato'] {
  const primeira = conversa[0];
  const quemProcurou = l.chamouPrimeiro ? 'ele' : primeira ? (primeira.autor === 'eu' ? 'nos' : 'ele') : null;
  const nossaPrimeira = conversa.find((m) => m.autor === 'eu');
  // a última fala de gente (não automática) do cliente, depois da nossa última
  let perguntouAssunto = false;
  for (let i = conversa.length - 1; i >= 0; i--) {
    const m = conversa[i];
    if (m.autor === 'eu') break;
    if (!m.automatica && PERGUNTOU_ASSUNTO.test(m.texto)) perguntouAssunto = true;
  }
  return {
    quemProcurou,
    motivo: quemProcurou === 'nos' && nossaPrimeira ? nossaPrimeira.texto.replace(/\s+/g, ' ').slice(0, 400) : null,
    perguntouAssunto: quemProcurou === 'nos' && perguntouAssunto,
  };
}

export function fichaComercial(l: LeadComercial, s: LeituraSite | null, conversa: FalaComercial[], agora = Date.now()): FichaComercial {
  const estagio = estagioDoLead(l, conversa, agora);
  return {
    estagio,
    contato: contatoDe(l, conversa),
    fatos: fatosDe(l, s, conversa),
    oportunidades: oportunidadesDe(l, s),
    naoSabemos: naoSabemosDe(l, s, conversa),
    followUp: followUpDe(conversa, estagio, agora),
  };
}

/** a ficha em texto para a IA (curta: a IA do PC tem pouca memória) */
export function fichaEmTexto(f: FichaComercial): string {
  const e = ESTAGIOS[f.estagio];
  return [
    '<ficha_comercial>',
    `Estágio: ${e.rotulo}. Objetivo deste estágio: ${e.objetivo}`,
    f.contato.quemProcurou === 'nos'
      ? `Quem procurou quem: FOMOS NÓS que procuramos este lead (prospecção). Ele não pediu nada. Motivo do nosso contato, na primeira mensagem: "${f.contato.motivo || ''}"`
      : f.contato.quemProcurou === 'ele'
        ? 'Quem procurou quem: foi ELE quem nos procurou.'
        : null,
    f.contato.perguntouAssunto
      ? 'ATENÇÃO: a pessoa perguntou do que se trata ("no que posso ajudar?" ou parecido). Ela NÃO é cliente pedindo serviço: responda retomando o motivo do nosso contato em 1 frase (o mesmo da primeira mensagem) e pergunte se é ela quem cuida do site/divulgação ou com quem você pode falar sobre isso. Proibido responder "como posso ajudar" ou oferecer lista de serviços.'
      : null,
    'Fatos (observados, pode usar):',
    ...(f.fatos.length ? f.fatos.map((x) => `- ${x}`) : ['- quase nada além do nome']),
    'Oportunidades possíveis (HIPÓTESES: pergunte ou confirme antes de afirmar; escolha no máximo uma por mensagem):',
    ...(f.oportunidades.length ? f.oportunidades.map((o) => `- ${o.servico}: ${o.motivo}`) : ['- nenhuma evidente: prefira abordagem exploratória (pergunte, não diagnostique)']),
    f.naoSabemos.length ? `Ainda não sabemos: ${f.naoSabemos.join(' ')}` : null,
    `Follow-up: ${f.followUp.recomendacao}`,
    '</ficha_comercial>',
  ]
    .filter(Boolean)
    .join('\n');
}
