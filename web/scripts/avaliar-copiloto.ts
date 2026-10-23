/**
 * Avaliação do copiloto comercial e do robô: roda cenários representativos
 * na IA de verdade e confere cada saída com regras objetivas (número
 * inventado, frase de telemarketing, ação certa para o estágio, tamanho,
 * pedido de parar respeitado...). Escreve um relatório em Markdown com as
 * saídas, para ler e dar nota.
 *
 * Uso (na pasta web):
 *   node_modules/.bin/jiti scripts/avaliar-copiloto.ts [arquivo-de-saida.md]
 *
 * Usa o Groq (GROQ_API_KEY no .env.local; a IA do PC só com USAR_PC=1) e o treino da conta da
 * Vertion (só leitura). Os cenários são inventados; vão para o Groq junto com o treino,
 * e nenhuma mensagem é enviada a cliente.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..');
for (const l of readFileSync(join(WEB, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
// a placa do PC travou duas vezes com a IA contínua (23/10/2026): testes vão para o Groq.
// A IA do PC só com USAR_PC=1, por conta e risco.
if (process.env.USAR_PC === '1') {
  process.env.OLLAMA_URL ||= 'http://127.0.0.1:11434';
  process.env.OLLAMA_SEGREDO ||= 'local';
  delete process.env.GROQ_API_KEY;
} else {
  delete process.env.OLLAMA_URL;
  if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY no .env.local (ou rode com USAR_PC=1).');
}

const { gerarCopiloto, numerosInventados, PROMESSA } = await import('../lib/copiloto');
const { fichaComercial, ESTAGIOS } = await import('../lib/comercial');
const { analisarHtml } = await import('../lib/leitura-site');
const { montarInstrucoes, montarPedido, decidir } = await import('../lib/robo-cerebro');
const { fichaEmTexto } = await import('../lib/comercial');
const { contaDaConversa } = await import('../lib/conversa');
const { treinoDoRobo } = await import('../lib/robo');
import type { EntradaCopiloto, Tarefa } from '../lib/copiloto';
import type { LeadComercial, FalaComercial } from '../lib/comercial';
import type { LeituraSite } from '../lib/leitura-site';

const conta = await contaDaConversa();
if (!conta) throw new Error('conta da Vertion não encontrada');
const treino = await treinoDoRobo(conta);

const DIA = 86_400_000;
const agora = Date.now();
const ha = (dias: number, horas = 0) => new Date(agora - dias * DIA - horas * 3_600_000).toISOString();

const LEAD_BASE: LeadComercial = {
  nome: '', tipo: 'comercio', ramo: null, cidade: 'Rio de Janeiro', status: 'novo', websiteKind: 'none', website: null,
  siteStatus: null, siteDetalhe: null, rating: null, reviews: null, instagram: false, semAnuncio: null, chamouPrimeiro: false,
  interesse: [], ideia: null, briefing: null, notas: null, temPrevia: false, temProposta: false, propostaAberturas: 0, lembreteEm: null, lembreteTexto: null,
};

const SITE_TECHRJ: LeituraSite = {
  url: 'http://techrj.com.br/', titulo: 'TechRJ – Contabilidade', descricao: null,
  assuntos: ['Há mais de 40 anos moldando histórias de sucesso', 'Temos equipes especializadas para cada porte de empresa', 'Nossos serviços', 'Por que escolher a Tech RJ?', 'Perguntas frequentes'],
  formulario: true, whatsapp: true, telefoneClicavel: false, email: false, agendamento: false, orcamento: true, celular: true, instagram: true, texto: 5573, lido: true,
};
const SITE_CLINICA = analisarHtml('https://clinicasorriso.com.br/', `<html><head><title>Clínica Sorriso Copacabana</title><meta name="viewport" content="width=device-width"><meta name="description" content="Odontologia completa em Copacabana: implantes, clareamento e ortodontia."></head><body><h1>Seu sorriso em boas mãos</h1><h2>Tratamentos</h2><h2>Nossa equipe</h2><p>${'Cuidamos do seu sorriso com tecnologia. '.repeat(60)}</p><a href="tel:2133334444">Ligue</a></body></html>`);
const SITE_MAGENTA: LeituraSite = { url: 'https://www.coletivomagenta.com/', titulo: 'casa.magenta — Arquitetura Afetiva | Em breve', descricao: 'Em breve, uma nova experiência.', assuntos: ['Estamos cocriando um novo espaço .'], formulario: false, whatsapp: true, telefoneClicavel: false, email: false, agendamento: false, orcamento: false, celular: true, instagram: true, texto: 331, lido: true };

interface Cenario {
  id: string;
  titulo: string;
  tarefa: Tarefa;
  pedido?: string;
  lead: Partial<LeadComercial>;
  site?: LeituraSite | null;
  conversa?: FalaComercial[];
  valores?: string | null;
  previa?: string | null;
  /** regras específicas deste cenário */
  esperar?: { acoes?: string[]; semMensagem?: boolean; proibido?: RegExp[]; obrigatorio?: RegExp[]; max?: number; terminaComPergunta?: boolean; assunto?: boolean };
}

const eu = (texto: string, dias: number, horas = 0): FalaComercial => ({ autor: 'eu', texto, em: ha(dias, horas) });
const ele = (texto: string, dias: number, horas = 0): FalaComercial => ({ autor: 'cliente', texto, em: ha(dias, horas) });
const ABERTURA = 'Opa, tudo certo? Aqui é o Lucas, da Vertion Stack. Vi que vocês não têm site no Google e queria te mostrar uma ideia rápida. Posso mandar?';

const CENARIOS: Cenario[] = [
  { id: 'a1', titulo: 'Abordagem: barbearia sem site, bem avaliada', tarefa: 'abordagem', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', rating: 4.8, reviews: 132, instagram: true }, esperar: { obrigatorio: [/Lucas/, /Z[ée]/i], max: 420, terminaComPergunta: true } },
  { id: 'a2', titulo: 'Abordagem: site bom + pedido "tem site, está bom, dá para deixar mais atrativo"', tarefa: 'abordagem', pedido: 'Tem site, está bom, mas dá para melhorar, dá para deixar mais atrativo', lead: { nome: 'Tech RJ - Contabilidade', ramo: 'Contabilidade', websiteKind: 'site', website: 'http://techrj.com.br/', siteStatus: 'ok', rating: 4.9, reviews: 60 }, site: SITE_TECHRJ, esperar: { obrigatorio: [/Lucas/, /Tech ?RJ/i], max: 420, proibido: [/constru[çc][ãa]o|inacabad|em breve|fora do ar|n[ãa]o abre|sem https|n[ãa]o [ée] seguro/i], terminaComPergunta: true } },
  { id: 'a3', titulo: 'Abordagem: clínica com site bom e sem agendamento na página', tarefa: 'abordagem', lead: { nome: 'Clínica Sorriso Copacabana', ramo: 'Clínica odontológica', websiteKind: 'site', website: 'https://clinicasorriso.com.br/', siteStatus: 'ok', rating: 4.6, reviews: 88 }, site: SITE_CLINICA, esperar: { obrigatorio: [/Lucas/, /Sorriso/i], max: 420, proibido: [/site\s+(est[áa]\s+)?(ruim|feio|ultrapassado|quebrado)/i, /n[ãa]o tem (um |nenhum )?(bot[ãa]o|formul|agendamento)|sem (bot[ãa]o|formul[áa]rio)|atrapalh|perd(e|endo) (cliente|paciente)/i], terminaComPergunta: true } },
  { id: 'a4', titulo: 'Abordagem: site em construção (de verdade)', tarefa: 'abordagem', lead: { nome: 'Casa Magenta Arquitetura Afetiva', ramo: 'Arquiteto', websiteKind: 'site', website: 'https://www.coletivomagenta.com/', siteStatus: 'em_construcao', siteDetalhe: 'A página no ar não é um site de verdade (encontrei “em construção”).', instagram: true }, site: SITE_MAGENTA, esperar: { obrigatorio: [/Lucas/, /Magenta/i], max: 420, terminaComPergunta: true } },
  { id: 'a5', titulo: 'Abordagem: contexto mínimo (só nome e ramo)', tarefa: 'abordagem', lead: { nome: 'Auto Peças Silva', ramo: 'Loja de autopeças', websiteKind: 'site', website: 'https://autopecassilva.com.br', siteStatus: 'bloqueado' }, site: { url: 'https://autopecassilva.com.br', titulo: null, descricao: null, assuntos: [], formulario: false, whatsapp: false, telefoneClicavel: false, email: false, agendamento: false, orcamento: false, celular: false, instagram: false, texto: 0, lido: false }, esperar: { obrigatorio: [/Lucas/, /Silva|Auto ?Pe[çc]as/i], max: 420, proibido: [/site\s+(est[áa]\s+)?(fora|ruim|com problema|n[ãa]o abre|lento)/i, /forte presen|muita gente|muito conhecid|refer[êe]ncia (no|em)|tradicional/i] } },
  { id: 'r1', titulo: 'Resposta: "Quanto custa?" sem proposta', tarefa: 'resposta', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'contatado' }, conversa: [eu(ABERTURA, 1), ele('Oi, pode mandar. Quanto custa?', 0, 2)], esperar: { proibido: [/R\$\s?\d/], max: 450 } },
  { id: 'r2', titulo: 'Resposta: "Tá caro" com proposta', tarefa: 'resposta', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'negociando', temProposta: true, propostaAberturas: 2 }, valores: 'entrada R$ 590,00, mensalidade R$ 60,00', conversa: [eu(ABERTURA, 6), ele('Manda sim', 6), eu('Aqui a proposta: https://leads.vertionstack.com/p/abc', 2), ele('Achei caro, viu', 0, 1)], esperar: { proibido: [/desconto de|\d+\s?%|R\$\s?(?!590|60)\d/i, /\bZ[ée]\b/], max: 450 } },
  { id: 'r3', titulo: 'Resposta: "Já tenho alguém que cuida disso"', tarefa: 'resposta', lead: { nome: 'Pet Shop Amigo Fiel', ramo: 'Pet shop', status: 'contatado', websiteKind: 'site', siteStatus: 'ok' }, conversa: [eu('Oi! Aqui é o Lucas, da Vertion Stack. Vocês recebem pedido de banho e tosa pelo site ou só pelo WhatsApp?', 1), ele('Já tenho um rapaz que cuida disso pra gente', 0, 3)], esperar: { proibido: [/melhor (do )?que (ele|o seu)|ele n[ãa]o|amador|barato sai caro/i], max: 400 } },
  { id: 'r4', titulo: 'Resposta: "Não tenho interesse, obrigado"', tarefa: 'resposta', lead: { nome: 'Padaria Pão Quente', ramo: 'Padaria', status: 'contatado' }, conversa: [eu(ABERTURA, 2), ele('Não tenho interesse, obrigado', 0, 1)], esperar: { acoes: ['encerrar'], obrigatorio: [/obrigad|valeu/i], max: 220, proibido: [/mas |por[ée]m|que tal|posso te mostrar|s[óo] (uma|um) (minuto|ideia)/i] } },
  { id: 'r5', titulo: 'Resposta: pediu para parar', tarefa: 'resposta', lead: { nome: 'Oficina Rápida', ramo: 'Oficina mecânica', status: 'contatado' }, conversa: [eu(ABERTURA, 3), ele('Para de me mandar mensagem, por favor', 0, 1)], esperar: { acoes: ['encerrar'], semMensagem: true } },
  { id: 'r6', titulo: 'Resposta: "Pode mandar mais informações?"', tarefa: 'resposta', lead: { nome: 'Studio Bella Estética', ramo: 'Estética', status: 'contatado', rating: 4.9, reviews: 210 }, conversa: [eu('Oi! Aqui é o Lucas, da Vertion Stack. Vi que o Studio Bella tem nota 4,9 no Google, parabéns. Vocês marcam os horários só pelo WhatsApp hoje?', 1), ele('Oi! Pode mandar mais informações?', 0, 2)], esperar: { max: 500 } },
  { id: 'r7', titulo: 'Resposta: "Preciso falar com meu sócio"', tarefa: 'resposta', lead: { nome: 'Construtora Fermil', ramo: 'Construtora', status: 'negociando', temProposta: true, propostaAberturas: 1 }, conversa: [eu('Segue a proposta: https://leads.vertionstack.com/p/xyz', 1), ele('Gostei, mas preciso falar com meu sócio antes', 0, 4)], esperar: { proibido: [/s[óo] (at[ée]|hoje)|[úu]ltim[ao]s? (vaga|dia)|promo[çc][ãa]o v[áa]lida/i], max: 400 } },
  { id: 'r8', titulo: 'Resposta: "Já tenho site" (site no ar)', tarefa: 'resposta', lead: { nome: 'Clínica Sorriso Copacabana', ramo: 'Clínica odontológica', status: 'contatado', websiteKind: 'site', siteStatus: 'ok' }, site: SITE_CLINICA, conversa: [eu('Oi! Aqui é o Lucas, da Vertion Stack. Vocês recebem pedido de agendamento pelo site?', 1), ele('Já temos site', 0, 2)], esperar: { proibido: [/site\s+(est[áa]\s+)?(ruim|feio|ultrapassado|quebrado|com problema)/i], max: 400 } },
  { id: 'r9', titulo: 'Resposta: "Me chama mês que vem"', tarefa: 'resposta', lead: { nome: 'Padaria Pão Quente', ramo: 'Padaria', status: 'contatado' }, conversa: [eu(ABERTURA, 1), ele('Agora não dá, me chama mês que vem', 0, 1)], esperar: { max: 300, proibido: [/mas (antes|s[óo])|que tal (agora|hoje)/i] } },
  { id: 'f1', titulo: 'Follow-up: 1 mensagem sem resposta há 4 dias', tarefa: 'followup', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'contatado', rating: 4.8, reviews: 132 }, conversa: [eu(ABERTURA, 4)], esperar: { proibido: [/viu (a )?minha mensagem|passando|conseguiu ver|s[óo] (para|pra) lembrar|aqui [ée] o lucas|sou o lucas/i], max: 380 } },
  { id: 'f2', titulo: 'Follow-up: 3 mensagens sem resposta', tarefa: 'followup', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'contatado' }, conversa: [eu(ABERTURA, 12), eu('Oi! Conseguiu ver?', 8), eu('Opa, passando aqui de novo', 4)], esperar: { acoes: ['aguardar', 'encerrar'] } },
  { id: 'f3', titulo: 'Follow-up: mandou ontem', tarefa: 'followup', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'contatado' }, conversa: [eu(ABERTURA, 0, 20)], esperar: { acoes: ['aguardar'] } },
  { id: 'v1', titulo: 'Áudio: abordagem para barbearia sem site', tarefa: 'audio', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', rating: 4.8, reviews: 132 }, esperar: { proibido: [/https?:\/\/|[\u{1F300}-\u{1FAFF}]/u], max: 700 } },
  { id: 'e1', titulo: 'E-mail: abordagem para contabilidade com site bom', tarefa: 'email', lead: { nome: 'Tech RJ - Contabilidade', ramo: 'Contabilidade', websiteKind: 'site', siteStatus: 'ok' }, site: SITE_TECHRJ, esperar: { assunto: true, max: 1100, proibido: [/constru[çc][ãa]o|inacabad/i] } },
  { id: 'p1', titulo: 'Próximo passo: cliente pediu exemplo e já existe prévia', tarefa: 'proximo_passo', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'contatado', temPrevia: true }, previa: 'https://barbearia-do-ze.vertionstack.com', conversa: [eu(ABERTURA, 1), ele('Tem algum exemplo pra eu ver como ficaria?', 0, 1)], esperar: { obrigatorio: [/barbearia-do-ze\.vertionstack\.com/] } },
];

const { TELEMARKETING } = await import('../lib/copiloto');

function conferir(c: Cenario, r: Awaited<ReturnType<typeof gerarCopiloto>>, dados: string): string[] {
  const falhas: string[] = [];
  const x = r.resposta;
  const texto = `${x.mensagem}\n${x.alternativa}`;
  const e = c.esperar || {};
  if (e.acoes && !e.acoes.includes(x.acao)) falhas.push(`ação "${x.acao}" (esperado: ${e.acoes.join(' ou ')})`);
  if (e.semMensagem && x.mensagem) falhas.push('escreveu mensagem quando não devia');
  if (!e.semMensagem && !e.acoes?.every((a) => a !== 'escrever') && x.acao === 'escrever' && !x.mensagem) falhas.push('ação escrever sem mensagem');
  const inv = numerosInventados(texto + ' ' + x.assunto, dados);
  if (inv.length) falhas.push(`número fora dos dados: ${inv.join(', ')}`);
  if (TELEMARKETING.test(texto)) falhas.push('frase de telemarketing');
  if (/\[[^\]]+\]/.test(texto)) falhas.push('[colchetes]');
  if (c.tarefa !== 'email' && /^\s*[-•*]\s/m.test(texto)) falhas.push('lista no WhatsApp');
  if (c.tarefa !== 'email' && x.assunto) falhas.push('assunto fora de e-mail');
  if (PROMESSA.test(texto)) falhas.push(`promessa de resultado: ${texto.match(PROMESSA)?.[0]}`);
  for (const p of e.proibido || []) if (p.test(texto)) falhas.push(`trecho proibido: ${texto.match(p)?.[0]}`);
  for (const p of e.obrigatorio || []) if (!p.test(texto)) falhas.push(`faltou: ${p}`);
  if (e.max && x.mensagem.length > e.max) falhas.push(`longa demais (${x.mensagem.length} > ${e.max})`);
  if (e.terminaComPergunta && x.mensagem && !/\?\s*\S{0,3}\s*$/.test(x.mensagem.trim())) falhas.push('não termina com pergunta');
  if (e.assunto && !x.assunto) falhas.push('e-mail sem assunto');
  if (x.alternativa && x.alternativa.replace(/\W+/g, '').toLowerCase() === x.mensagem.replace(/\W+/g, '').toLowerCase()) falhas.push('outra opção igual à mensagem');
  if (/^nada\b/i.test(x.precisa_confirmar)) falhas.push('"confirmar" preenchido com nada');
  if (r.avisos.length) falhas.push(`avisos: ${r.avisos.join(' | ')}`);
  return falhas;
}

const saida = process.argv[2] || join(WEB, 'scripts', 'avaliacao-copiloto.md');
const linhas: string[] = [`# Avaliação do copiloto comercial\n\nRodada em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, IA: ${process.env.USAR_PC === '1' ? 'a do PC' : 'Groq'}.\n`];
let passou = 0;
const tempos: number[] = [];

const PAUSA_MS = Number(process.env.PAUSA_MS ?? 9000);
const pausa = () => new Promise((r) => setTimeout(r, PAUSA_MS));

for (const c of CENARIOS) {
  await pausa();
  const lead = { ...LEAD_BASE, ...c.lead } as LeadComercial;
  const conversa = c.conversa || [];
  const ficha = fichaComercial(lead, c.site ?? null, conversa, agora);
  const e: EntradaCopiloto = {
    tarefa: c.tarefa, tom: 'padrao', pedido: c.pedido || '', cfg: treino.cfg, empresa: treino.empresa, oferta: treino.oferta, quem: 'o Lucas',
    nomeLead: lead.nome, tipoLead: lead.tipo, ficha,
    conversa: conversa.map((m) => ({ autor: m.autor, texto: m.texto, automatica: m.automatica, quando: new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) })),
    anteriores: [], variacao: null, previa: c.previa || null, proposta: c.lead.temProposta ? 'https://leads.vertionstack.com/p/abc' : null, valores: c.valores || null,
    links: [c.previa, c.lead.temProposta ? 'https://leads.vertionstack.com/p/abc' : null].filter((x): x is string => Boolean(x)),
  };
  const t0 = Date.now();
  let falhas: string[];
  let r: Awaited<ReturnType<typeof gerarCopiloto>> | null = null;
  try {
    r = await gerarCopiloto(e);
    const { pedidoCopiloto } = await import('../lib/copiloto');
    falhas = conferir(c, r, [pedidoCopiloto(e), treino.cfg.sobre, treino.cfg.servicos, treino.cfg.prazos, treino.cfg.pagamento, treino.cfg.perguntas.map((p) => p.resposta).join(' ')].join(' '));
  } catch (err) {
    falhas = [`erro: ${(err as Error).message}`];
  }
  const ms = Date.now() - t0;
  if (r?.uso) tempos.push(ms);
  if (!falhas.length) passou++;
  console.log(`${falhas.length ? 'FALHOU' : 'ok    '} ${c.id} ${c.titulo} (${(ms / 1000).toFixed(1)} s)${falhas.length ? ' — ' + falhas.join('; ') : ''}`);
  linhas.push(`## ${c.id}. ${c.titulo}\n`);
  linhas.push(`- Estágio calculado: **${ESTAGIOS[ficha.estagio].rotulo}** · oportunidades: ${ficha.oportunidades.map((o) => o.servico).join(', ') || 'nenhuma'}`);
  linhas.push(`- Resultado: ${falhas.length ? `**falhou** (${falhas.join('; ')})` : 'passou nas regras'} · ${(ms / 1000).toFixed(1)} s · ${r?.uso ? `${r.uso.entrada} tokens de entrada` : 'sem IA (trava)'}`);
  if (r) {
    const x = r.resposta;
    linhas.push(`- Leitura: ${x.leitura}\n- Objetivo: ${x.objetivo}\n- Estratégia: ${x.estrategia}\n- Ação: \`${x.acao}\`${x.precisa_confirmar ? ` · confirmar: ${x.precisa_confirmar}` : ''}`);
    if (x.assunto) linhas.push(`- Assunto: ${x.assunto}`);
    linhas.push('\n> ' + (x.mensagem || '(sem mensagem)').replace(/\n/g, '\n> '));
    if (x.alternativa) linhas.push('\nOutra opção:\n\n> ' + x.alternativa.replace(/\n/g, '\n> '));
    linhas.push(`\nPor quê: ${x.por_que}${x.proximo_passo ? ` · Depois: ${x.proximo_passo}` : ''}\n`);
  }
}

// o robô do WhatsApp com a ficha nova: três situações
const ROBO: { id: string; titulo: string; lead: Partial<LeadComercial>; conversa: FalaComercial[]; valores?: string; esperar: (d: { acao: string; mensagens: string[] }) => string[] }[] = [
  {
    id: 'b1', titulo: 'Robô: "quanto fica?" com proposta e valores', lead: { nome: 'Barbearia do Zé', ramo: 'Barbearia', status: 'negociando', temProposta: true }, valores: 'entrada R$ 590,00, mensalidade R$ 60,00',
    conversa: [eu('Aqui a proposta: https://leads.vertionstack.com/p/abc', 1), ele('quanto fica no total?', 0, 1)],
    esperar: (d) => [
      ...(/R\$\s?(?!590|60)\d/.test(d.mensagens.join(' ')) ? ['valor que não é da proposta'] : []),
      ...(/\bZ[ée]\b/.test(d.mensagens.join(' ')) ? ['chamou pelo nome da empresa ("Zé")'] : []),
    ],
  },
  { id: 'b2', titulo: 'Robô: "não tenho interesse"', lead: { nome: 'Padaria Pão Quente', ramo: 'Padaria', status: 'contatado' }, conversa: [eu(ABERTURA, 1), ele('não tenho interesse não, obrigado', 0, 1)], esperar: (d) => (d.acao === 'encerrar' ? [] : [`ação ${d.acao} (esperado encerrar)`]) },
  { id: 'b3', titulo: 'Robô: quem chamou primeiro pelo Instagram', lead: { nome: 'Diogo', tipo: 'pessoa', chamouPrimeiro: true, status: 'contatado' }, conversa: [ele('Oi, vi vocês no Instagram, vocês fazem site?', 0, 1)], esperar: (d) => (/(vi|achei|encontrei) (a sua|sua|o seu|seu) (empresa|site|perfil|neg[óo]cio)/i.test(d.mensagens.join(' ')) ? ['disse que achou o negócio dele'] : []) },
];
const instrucoesRobo = montarInstrucoes(treino.cfg, treino.empresa, treino.oferta, []);
linhas.push('# Robô do WhatsApp (com a ficha comercial)\n');
for (const c of ROBO) {
  await pausa();
  const lead = { ...LEAD_BASE, ...c.lead } as LeadComercial;
  const ficha = fichaComercial(lead, null, c.conversa, agora);
  const pedido = montarPedido(
    { tipo: lead.tipo, nome: lead.nome, ramo: lead.ramo, cidade: lead.cidade, problema: null, avaliacoes: null, interesse: [], ideia: null, previa: null, proposta: lead.temProposta ? 'https://leads.vertionstack.com/p/abc' : null, valores: c.valores || null, chamouPrimeiro: lead.chamouPrimeiro, ficha: fichaEmTexto(ficha) },
    c.conversa.map((m) => ({ autor: m.autor, texto: m.texto })),
    [],
    null,
  );
  const t0 = Date.now();
  let falhas: string[] = [];
  let d: { acao: string; mensagens: string[]; leitura: string } | null = null;
  try {
    const r = await decidir(instrucoesRobo, pedido, false);
    d = r.decisao;
    // a mesma trava do robô de verdade: número fora dos dados não é enviado, ele chama o dono
    const barrado = numerosInventados(d.mensagens.join(' '), `${instrucoesRobo} ${pedido}`);
    if (barrado.length) {
      d = { ...d, leitura: `[BARRADO pela trava: citou ${barrado.join(', ')}; não seria enviado, o robô chamaria o dono] ${d.leitura}` };
      falhas = [];
    } else falhas = c.esperar(d);
    if (TELEMARKETING.test(d.mensagens.join(' '))) falhas.push('frase de telemarketing');
  } catch (err) {
    falhas = [`erro: ${(err as Error).message}`];
  }
  const ms = Date.now() - t0;
  tempos.push(ms);
  if (!falhas.length) passou++;
  console.log(`${falhas.length ? 'FALHOU' : 'ok    '} ${c.id} ${c.titulo} (${(ms / 1000).toFixed(1)} s)${falhas.length ? ' — ' + falhas.join('; ') : ''}`);
  linhas.push(`## ${c.id}. ${c.titulo}\n\n- Resultado: ${falhas.length ? `**falhou** (${falhas.join('; ')})` : 'passou nas regras'} · ${(ms / 1000).toFixed(1)} s\n- Leitura: ${d?.leitura || ''} · Ação: \`${d?.acao || ''}\`\n\n> ${(d?.mensagens || []).join('\n>\n> ') || '(nada)'}\n`);
}

const total = CENARIOS.length + ROBO.length;
const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length / 1000 : 0;
linhas.splice(1, 0, `**${passou} de ${total} cenários passaram nas regras automáticas.** Tempo médio por pedido: ${media.toFixed(1)} s.\n`);
writeFileSync(saida, linhas.join('\n'));
console.log(`\n${passou}/${total} passaram. Tempo médio ${media.toFixed(1)} s. Relatório: ${saida}`);
process.exit(0);
