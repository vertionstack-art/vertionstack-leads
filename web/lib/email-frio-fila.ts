/**
 * A fila de e-mails do exterior, do lado do banco: quem ainda pode receber
 * o primeiro e-mail e o que já foi escrito, aprovado ou enviado.
 */

import { buscarLead, type Lead } from './db';
import { db } from './sql';
import { ehEstrangeiro } from './pais';
import { temperaturaDoLead, type Nivel } from './temperatura';
import { demoValida, estaBloqueado, escreverEmail, fusoDoLead, MARCA_DEMO, proximaJanela } from './email-frio';
import { tamanhoDigital, NOME_DO_PORTE } from './redes';
import { comPreco, lerValor, moedaValida, type Moeda } from './preco-email';

export interface CandidatoEmail {
  id: string;
  nome: string;
  cidade: string | null;
  categoria: string | null;
  email: string;
  nivel: Nivel;
  pontos: number;
  porte: string;
  avaliacoes: number | null;
  nota: number | null;
  siteNota: number | null;
  temConcorrente: boolean;
  temPrevia: boolean;
}

export interface EmailNaFila {
  id: string;
  leadId: string;
  nome: string;
  cidade: string | null;
  para: string;
  assunto: string;
  corpo: string;
  status: 'rascunho' | 'aprovado' | 'enviando' | 'enviado' | 'erro' | 'cancelado';
  fuso: string;
  /** quando abre a janela de envio de lá (só para os aprovados) */
  saiEm: string | null;
  enviadoEm: string | null;
  erro: string | null;
  /** a resposta que chegou (lib/email-respostas) */
  respostaTipo: string | null;
  respostaResumo: string | null;
  respondidoEm: string | null;
  /** para abrir a conversa no Gmail */
  respostaMessageId: string | null;
  /** o site de demonstração feito para a empresa (vai no lugar do [DEMO]) */
  demoUrl: string | null;
  /** o valor do site que o Lucas digitou (entra numa frase depois da demo) */
  preco: number | null;
  moeda: Moeda | null;
}

/** leads do exterior com e-mail que ainda não ganharam e-mail (o mais quente primeiro) */
export async function candidatosEmail(conta: string): Promise<CandidatoEmail[]> {
  const linhas = await db()`
    select l.id from leads l
    where l.conta_id = ${conta}
      and l.email is not null
      and l.status = 'novo'
      and l.phone like '+%' and l.phone not like '+55%'
      and not exists (select 1 from emails_frios e where e.conta_id = l.conta_id and e.lead_id = l.id and e.status <> 'cancelado')
      and not exists (select 1 from emails_bloqueados b where b.email = lower(l.email))
    order by l.updated_at desc
    limit 150
  `;
  const leads = (await Promise.all(linhas.map((r) => buscarLead(conta, r.id as string)))).filter((l): l is Lead => Boolean(l && ehEstrangeiro(l)));
  return leads
    .map((l) => {
      const t = temperaturaDoLead(l);
      return {
        id: l.id,
        nome: l.name,
        cidade: l.city,
        categoria: l.category,
        email: l.email!,
        nivel: t.nivel,
        pontos: t.pontos,
        porte: NOME_DO_PORTE[tamanhoDigital(l).porte],
        avaliacoes: l.reviews,
        nota: l.rating,
        siteNota: l.siteNota,
        temConcorrente: Boolean(l.concorrente),
        temPrevia: Boolean(l.previaUrl),
      };
    })
    .sort((a, b) => b.pontos - a.pontos);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function daLinha(r: Record<string, any>): EmailNaFila {
  return {
    id: r.id,
    leadId: r.lead_id,
    nome: r.nome,
    cidade: r.city ?? null,
    para: r.para,
    assunto: r.assunto,
    corpo: r.corpo,
    status: r.status,
    fuso: r.fuso,
    saiEm: r.status === 'aprovado' ? proximaJanela(r.fuso).toISOString() : null,
    enviadoEm: r.enviado_em ? new Date(r.enviado_em).toISOString() : null,
    erro: r.erro ?? null,
    respostaTipo: r.resposta_tipo ?? null,
    respostaResumo: r.resposta_resumo ?? null,
    respondidoEm: r.respondido_em ? new Date(r.respondido_em).toISOString() : null,
    respostaMessageId: r.resposta_mid ?? null,
    demoUrl: r.demo_url ?? null,
    preco: r.preco === null || r.preco === undefined ? null : Number(r.preco),
    moeda: moedaValida(r.moeda),
  };
}

export async function emailsDaConta(conta: string): Promise<EmailNaFila[]> {
  const linhas = await db()`
    select e.*, l.name as nome, l.city,
      (select x.message_id from emails_respostas x where x.email_frio_id = e.id and x.tipo <> 'automatica' order by x.recebida_em desc limit 1) as resposta_mid
    from emails_frios e
    join leads l on l.conta_id = e.conta_id and l.id = e.lead_id
    where e.conta_id = ${conta} and e.status <> 'cancelado'
    order by e.respondido_em desc nulls last, e.criado_em desc
    limit 300
  `;
  return linhas.map(daLinha);
}

export async function umEmail(conta: string, id: string): Promise<EmailNaFila | null> {
  const [r] = await db()`
    select e.*, l.name as nome, l.city,
      (select x.message_id from emails_respostas x where x.email_frio_id = e.id and x.tipo <> 'automatica' order by x.recebida_em desc limit 1) as resposta_mid
    from emails_frios e
    join leads l on l.conta_id = e.conta_id and l.id = e.lead_id
    where e.conta_id = ${conta} and e.id = ${id}
  `;
  return r ? daLinha(r) : null;
}

/** escreve (ou reescreve) o e-mail de um lead e guarda como rascunho */
export async function gerarEmail(conta: string, leadId: string): Promise<EmailNaFila> {
  const lead = await buscarLead(conta, leadId);
  if (!lead) throw new Error('Lead não encontrado.');
  if (!ehEstrangeiro(lead)) throw new Error('Este lead é do Brasil: o contato aqui é pelo WhatsApp.');
  if (!lead.email) throw new Error('Este lead ainda não tem e-mail. Adicione no cartão dele.');
  if (await estaBloqueado(lead.email)) throw new Error('Esse e-mail pediu para não receber mais mensagens.');
  const [ja] = await db()`select status, preco, moeda from emails_frios where conta_id = ${conta} and lead_id = ${leadId}`;
  if (ja && ['enviando', 'enviado'].includes(ja.status)) throw new Error('Este lead já recebeu o e-mail.');

  const e = await escreverEmail(lead);
  // o valor que você já digitou volta no texto novo, no mesmo lugar
  if (ja?.preco && moedaValida(ja.moeda)) e.corpo = comPreco(e.corpo, Number(ja.preco), ja.moeda);
  const [r] = await db()`
    insert into emails_frios (conta_id, lead_id, para, assunto, corpo, status, fuso, modelo, demo_url)
    values (${conta}, ${leadId}, ${lead.email}, ${e.assunto}, ${e.corpo}, 'rascunho', ${fusoDoLead(lead)}, ${e.modelo}, ${demoValida(lead.previaUrl)})
    on conflict (conta_id, lead_id) do update set
      para = excluded.para, assunto = excluded.assunto, corpo = excluded.corpo, status = 'rascunho',
      fuso = excluded.fuso, modelo = excluded.modelo, criado_em = now(), aprovado_em = null, erro = null,
      -- escrever outro texto não apaga o link da demo que você já colou
      demo_url = coalesce(emails_frios.demo_url, excluded.demo_url)
    returning id
  `;
  return (await umEmail(conta, r.id))!;
}

export interface MudancaEmail {
  acao?: string;
  assunto?: unknown;
  corpo?: unknown;
  demo?: unknown;
  preco?: unknown;
  moeda?: unknown;
}

/**
 * Mexer num e-mail antes de ele sair: salvar o texto, aprovar (entra na fila
 * de envio), voltar para rascunho ou pedir outro texto. Usado pela tela do
 * site e pelo painel do PC (aba LANDING), com as mesmas regras.
 */
export async function mexerNoEmail(conta: string, id: string, c: MudancaEmail): Promise<{ ok: true; email: EmailNaFila } | { ok: false; erro: string; status: number }> {
  const atual = await umEmail(conta, id);
  if (!atual) return { ok: false, erro: 'E-mail não encontrado.', status: 404 };
  if (['enviando', 'enviado'].includes(atual.status)) return { ok: false, erro: 'Este e-mail já saiu.', status: 409 };

  const assunto = c.assunto === undefined ? null : String(c.assunto).replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const corpo = c.corpo === undefined ? null : String(c.corpo).replace(/\r/g, '').trim().slice(0, 4000);
  if (assunto !== null && assunto.length < 2) return { ok: false, erro: 'Escreva o assunto.', status: 400 };
  if (corpo !== null && corpo.length < 40) return { ok: false, erro: 'O texto ficou curto demais.', status: 400 };
  // o link da demo: vazio apaga, preenchido tem de ser um endereço https completo
  let demo: string | null | undefined = undefined;
  if (c.demo !== undefined) {
    demo = String(c.demo ?? '').trim() ? demoValida(c.demo) : null;
    if (String(c.demo ?? '').trim() && !demo) return { ok: false, erro: 'O link da demo precisa ser um endereço completo, começando com https://', status: 400 };
  }
  // o valor do site: vazio apaga; a frase no texto quem põe é a tela
  const preco = c.preco === undefined ? undefined : lerValor(c.preco);
  const moeda = moedaValida(c.moeda);
  if (assunto !== null || corpo !== null || demo !== undefined || preco !== undefined) {
    await db()`
      update emails_frios set
        assunto = coalesce(${assunto}, assunto),
        corpo = coalesce(${corpo}, corpo),
        demo_url = case when ${demo !== undefined} then ${demo ?? null} else demo_url end,
        preco = case when ${preco !== undefined} then ${preco ?? null}::numeric else preco end,
        moeda = case when ${preco !== undefined} then ${preco ? moeda : null} else moeda end
      where conta_id = ${conta} and id = ${id}
    `;
  }

  if (c.acao === 'aprovar') {
    // regra do Lucas: todo e-mail leva a demo
    const [e] = await db()`select corpo, demo_url from emails_frios where conta_id = ${conta} and id = ${id}`;
    if (!demoValida(e?.demo_url)) return { ok: false, erro: 'Cole o link da demo antes de aprovar: todo e-mail leva a demo.', status: 400 };
    if (!String(e.corpo).includes(MARCA_DEMO) && !String(e.corpo).includes(String(e.demo_url))) {
      return { ok: false, erro: `Escreva ${MARCA_DEMO} no texto, no lugar onde o link da demo deve aparecer.`, status: 400 };
    }
    await db()`update emails_frios set status = 'aprovado', aprovado_em = now(), erro = null where conta_id = ${conta} and id = ${id} and status in ('rascunho', 'erro')`;
  } else if (c.acao === 'voltar') {
    await db()`update emails_frios set status = 'rascunho', aprovado_em = null where conta_id = ${conta} and id = ${id} and status in ('aprovado', 'erro')`;
  } else if (c.acao === 'regerar') {
    return { ok: true, email: await gerarEmail(conta, atual.leadId) };
  }
  return { ok: true, email: (await umEmail(conta, id))! };
}
