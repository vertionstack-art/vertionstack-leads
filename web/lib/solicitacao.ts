/**
 * O questionário que você manda para o dono preencher.
 *
 * Fecha o ciclo do briefing: em vez de você adivinhar a cor da marca e os
 * serviços reais, o comerciante responde no WhatsApp e você transcreve. As
 * perguntas vêm prontas por nicho porque o que falta para desenhar uma
 * advocacia não tem nada a ver com o que falta para uma pizzaria — uma
 * precisa de OAB e áreas de atuação, a outra de sabores e taxa de entrega.
 *
 * A granularidade aqui é maior que a dos oito ramos do catálogo de preço:
 * lá advocacia e oficina são ambas "serviços", o que basta para calcular
 * valor e não basta para perguntar. Por isso esta detecção é própria.
 *
 * Regras que valem para todo questionário, e que explicam o formato:
 * quem responde é um comerciante ocupado, no celular, entre um cliente e
 * outro. Então são poucas perguntas, numeradas, em linguagem de gente, e
 * o recado final diz que pode responder por áudio — porque metade vai
 * responder por áudio de qualquer jeito.
 */

import { artigoDe, nomeSemArtigo } from './genero';

export interface Questionario {
  /** o nicho reconhecido, para aparecer na tela */
  nicho: string;
  perguntas: string[];
}

/** o que todo comércio precisa responder, seja qual for o ramo */
const COMUNS = [
  'O nome do negócio deve aparecer exatamente como? (com acento, maiúscula, do jeitinho certo)',
  'Quais são as cores da sua marca? Se tiver logo, me manda o arquivo.',
  'Qual o horário de funcionamento, e se fecha em algum dia.',
  'Tem alguma foto boa do lugar, da equipe ou do trabalho de vocês? Pode mandar por aqui mesmo.',
];

/** o fecho, igual para todos: é o que faz a pessoa responder em vez de adiar */
const FECHAMENTO = [
  'Pode responder tudo de uma vez ou aos poucos, por escrito ou por áudio — o que for mais rápido pra você.',
  'Se não souber alguma, deixa em branco que eu resolvo.',
];

interface Nicho {
  nome: string;
  /** o que reconhece a categoria do Google Maps */
  padrao: RegExp;
  perguntas: string[];
}

/**
 * Os nichos, do mais específico para o mais genérico.
 *
 * A ordem importa: "clínica veterinária" bate em veterinária antes de
 * bater em clínica, e é por isso que veterinária vem primeiro.
 */
const NICHOS: Nicho[] = [
  {
    nome: 'Veterinária e pet shop',
    padrao: /veterin|pet shop|petshop|banho e tosa|agropecu/i,
    perguntas: [
      'Vocês fazem quais serviços? (banho, tosa, consulta, vacina, hospedagem, adestramento...)',
      'Atendem qual porte de animal? Só cão e gato ou outros também?',
      'Tem veterinário na casa? Se tem, qual o nome e o CRMV dele.',
      'Fazem atendimento de emergência ou fora do horário?',
      'Tem leva-e-traz do pet?',
      'Vendem ração e produtos, ou só serviço?',
      'Qual serviço traz mais cliente hoje?',
    ],
  },
  {
    nome: 'Clínica e consultório',
    padrao: /clínic|clinic|consultório|consultorio(?!a)|odonto|dentist|médic|medic|psicólog|psicolog|fisioterap|nutri|fonoaudi|laborat/i,
    perguntas: [
      'Quais especialidades vocês atendem?',
      'Nome do responsável técnico e o registro dele (CRM, CRO, CRP, CREFITO — o que for o caso).',
      'Atendem convênio? Quais? Ou só particular?',
      'Os principais procedimentos que vocês fazem.',
      'Como o paciente marca hoje: telefone, WhatsApp, balcão?',
      'Tem algum tratamento que vocês fazem e é difícil achar na cidade?',
      'Quantos profissionais atendem aí?',
    ],
  },
  {
    nome: 'Barbearia, salão e estética',
    padrao: /barbear|barbeir|cabelei|salão|salao|beleza|estétic|estetic|manicure|unha|sobrancelh|depila|maquiag|spa/i,
    perguntas: [
      'Me passa a lista de serviços com os preços. (corte, barba, coloração, progressiva, manicure... o que vocês fazem)',
      'Quantos profissionais atendem? Os clientes escolhem por profissional?',
      'Qual o serviço que mais sai, e qual o que dá mais lucro?',
      'Como funciona a marcação hoje: agenda no papel, WhatsApp, aplicativo?',
      'Trabalham com alguma marca de produto que valha destacar?',
      'Tem fotos de trabalhos feitos? Antes e depois funciona muito bem.',
      'Atendem por ordem de chegada também ou só com hora marcada?',
    ],
  },
  {
    nome: 'Restaurante, pizzaria e lanchonete',
    padrao: /restaurante|pizza|hamburgu|lanchonete|churrasc|comida|food|bar\b|pastel|marmit|sushi|espetinh|açaí|acai|temaki/i,
    perguntas: [
      'Me manda o cardápio com os preços. Pode ser foto do cardápio mesmo.',
      'Quais são os três pratos que mais saem?',
      'Fazem entrega? Qual a área e quanto custa a taxa?',
      'Trabalham com iFood ou só pedido direto?',
      'Tem algum prato que é a cara da casa, que só vocês fazem?',
      'Aceitam reserva? Tem espaço para quantas pessoas?',
      'Tem fotos boas dos pratos? Se não tiver, vale a pena tirar — é o que mais vende.',
    ],
  },
  {
    nome: 'Padaria, confeitaria e cafeteria',
    padrao: /padaria|panific|confeitar|doceria|cafeteria|café|cafe\b|bolo|sorvete|chocolat|tapioc/i,
    perguntas: [
      'O que vocês produzem? (pães, bolos, salgados, doces, café...)',
      'Fazem encomenda? De quê, e com quanto tempo de antecedência?',
      'Qual o produto mais famoso da casa?',
      'Tem café da manhã ou almoço servido?',
      'Fazem bolo de festa ou kit festa?',
      'Que horas sai o pão quente? Isso vale ouro na página.',
      'Tem fotos dos produtos?',
    ],
  },
  {
    nome: 'Academia e estúdio',
    padrao: /academia|fitness|crossfit|pilates|yoga|jiu|muay|luta|natação|natacao|dança|danca|personal|treinamento funcional/i,
    perguntas: [
      'Quais modalidades vocês oferecem?',
      'Me passa os planos e valores (mensal, trimestral, anual).',
      'Quais os horários das turmas ou de funcionamento?',
      'Tem aula experimental grátis?',
      'Quantos professores, e alguma formação que valha destacar?',
      'Qual a estrutura? (aparelhos, vestiário, estacionamento, ar-condicionado)',
      'Tem fotos do espaço? Quem procura academia quer ver onde vai treinar.',
    ],
  },
  {
    nome: 'Imobiliária e corretor',
    padrao: /imobiliá|imobilia|corretor|imóve|imove|loteament|constru[çc][ãa]o|incorporad/i,
    perguntas: [
      'Qual o seu CRECI? (é obrigatório aparecer no site)',
      'Vocês trabalham com quê: venda, aluguel, lançamento, ou tudo?',
      'Que tipo de imóvel e em quais bairros ou cidades?',
      'Qual a faixa de preço que mais sai?',
      'Me manda alguns imóveis para colocar na vitrine: foto, bairro, metragem e valor.',
      'Fazem avaliação de imóvel? Cobram por isso?',
      'Quantos anos de mercado, e quantos imóveis já venderam?',
    ],
  },
  {
    nome: 'Advocacia e contabilidade',
    padrao: /advoc|advogad|jurídic|juridic|contabil|contador|escritório de|escritorio de|assessoria|consultoria|despachante/i,
    perguntas: [
      'Qual o número da OAB (ou CRC, se for contabilidade)? É obrigatório aparecer.',
      'Quais áreas vocês atuam? (trabalhista, família, previdenciário, tributário...)',
      'Qual área traz mais cliente hoje?',
      'Atendem presencial, online, ou os dois?',
      'A primeira consulta é gratuita?',
      'Quantos anos de atuação, e quantos profissionais no escritório?',
      'Tem algum caso ou resultado que possa ser citado sem quebrar sigilo?',
      'Atendem qual região?',
      'Observação: pela regra da OAB, não posso colocar preço nem promessa de resultado. Vou escrever dentro do que o código permite.',
    ],
  },
  {
    nome: 'Oficina e mecânica',
    padrao: /oficina|mecânic|mecanic|funilar|borrach|auto center|autocenter|lava.?jato|lava.?rápido|retífica|retifica|pneu|escapament/i,
    perguntas: [
      'Quais serviços vocês fazem? (revisão, freio, suspensão, injeção, ar-condicionado...)',
      'Trabalham com quais marcas ou tipos de veículo?',
      'Fazem orçamento sem compromisso? Cobram para avaliar?',
      'Dão garantia? De quanto tempo?',
      'Tem guincho ou leva-e-traz?',
      'Qual serviço é o carro-chefe?',
      'Quantos anos de oficina, e quantos mecânicos?',
      'Tem foto da oficina e dos trabalhos? Passa confiança.',
    ],
  },
  {
    nome: 'Reforma e construção',
    padrao: /serralh|marcenar|vidraç|vidrac|elétric|eletric|encanad|hidráulic|hidraulic|pintur|reforma|gesso|drywall|piscina|jardinag|dedetiz|arquitet|engenhar|marmorar|granit/i,
    perguntas: [
      'Que tipo de serviço vocês fazem exatamente?',
      'Atendem casa, comércio, ou os dois?',
      'Trabalham com projeto próprio ou executam projeto de terceiro?',
      'Como funciona o orçamento? Precisa ir no local?',
      'Dão garantia do serviço?',
      'Atendem qual região?',
      'Me manda fotos de trabalhos prontos — nesse ramo é o que mais convence.',
      'Tem CNPJ e emitem nota? Cliente grande pergunta isso.',
    ],
  },
  {
    nome: 'Loja e varejo',
    padrao: /loja|boutique|ótica|otica|roupa|calçad|calcad|joalher|papelar|presente|móvei|movei|material de|distribuid|mercad|supermerc|farmác|farmac|floricult|livrar/i,
    perguntas: [
      'O que vocês vendem? Me passa as principais categorias.',
      'Quais marcas vocês trabalham? Muita gente procura pelo nome da marca.',
      'Qual a faixa de preço dos produtos?',
      'Fazem entrega? Qual a região?',
      'Aceitam quais formas de pagamento? Parcelam em quantas vezes?',
      'Tem algum produto ou linha que só vocês têm na cidade?',
      'Me manda fotos dos produtos e da loja.',
      'Vendem pelo WhatsApp também ou só na loja?',
    ],
  },
  {
    nome: 'Hospedagem e turismo',
    padrao: /hotel|pousada|hostel|chalé|chale|turis|viage|passeio|camping|resort|agência de/i,
    perguntas: [
      'Quantos quartos ou unidades, e qual a capacidade de cada um?',
      'O que está incluso? (café da manhã, ar, wi-fi, estacionamento, piscina)',
      'Qual a diária, e se muda por temporada.',
      'Como funciona a reserva e o pagamento?',
      'Qual o horário de entrada e saída?',
      'Aceitam pet? Aceitam criança?',
      'O que tem de bom por perto que vale citar?',
      'Me manda fotos dos quartos e das áreas comuns — é o que decide a reserva.',
      'Tem cadastro no Ministério do Turismo (Cadastur)?',
    ],
  },
  {
    nome: 'Escola e curso',
    padrao: /escola|colégio|colegio|curso|creche|ensino|idiomas|autoescola|auto escola|reforço|reforco|educa/i,
    perguntas: [
      'Quais cursos ou séries vocês oferecem?',
      'Qual a duração e a carga horária de cada um?',
      'Me passa os valores e as formas de pagamento.',
      'Tem turma em quais horários?',
      'Dão certificado? É reconhecido por algum órgão?',
      'Quantos alunos por turma?',
      'O que diferencia o método de vocês?',
      'Tem fotos da estrutura e das turmas?',
    ],
  },
  {
    nome: 'Festa e evento',
    padrao: /festa|evento|buffet|bufê|bufe|salão de festa|cerimonial|fotógraf|fotograf|filmage|dj\b|som e luz|decoraç/i,
    perguntas: [
      'Que tipo de evento vocês atendem? (aniversário, casamento, corporativo, infantil)',
      'O que está incluso no pacote?',
      'Qual a faixa de preço, e o que faz o preço variar?',
      'Atendem quantas pessoas no máximo?',
      'Com quanta antecedência precisa fechar?',
      'Trabalham com pacote fechado ou monta sob medida?',
      'Me manda fotos de eventos que vocês fizeram.',
      'Atendem qual região?',
    ],
  },
];

/** quando nada bate: perguntas que servem para qualquer comércio */
const GENERICO: string[] = [
  'Me explica em duas linhas o que o seu negócio faz e para quem.',
  'Quais são os serviços ou produtos principais? Se puder, com preço.',
  'Qual deles traz mais cliente hoje?',
  'O que faz o cliente escolher vocês e não o concorrente?',
  'Quantos anos de mercado?',
  'Como o cliente entra em contato hoje: WhatsApp, telefone, balcão?',
  'Atendem qual região?',
  'Tem fotos do trabalho, do espaço ou da equipe?',
];

export function questionarioPara(categoria: string | null | undefined): Questionario {
  const c = (categoria || '').trim();
  const achado = c ? NICHOS.find((n) => n.padrao.test(c)) : undefined;

  return {
    nicho: achado ? achado.nome : 'Comércio em geral',
    perguntas: [...(achado ? achado.perguntas : GENERICO), ...COMUNS],
  };
}

/**
 * O texto pronto para colar no WhatsApp.
 *
 * Começa dizendo por que está perguntando — sem isso parece formulário de
 * banco, e o dono não responde. Termina abrindo a porta do áudio, porque
 * comerciante ocupado responde por áudio e insistir em texto só atrasa.
 */
export function textoDaSolicitacao(
  nomeDoComercio: string,
  categoria: string | null | undefined,
  previaUrl?: string | null,
): string {
  const q = questionarioPara(categoria);
  const nome = (nomeDoComercio || '').trim();

  const linhas: string[] = [];

  const comNome = nome ? `${artigoDe(nome)} ${nomeSemArtigo(nome)}` : '';

  if (previaUrl) {
    linhas.push(
      `Boa! Que bom que gostou. Pra eu deixar a página ${comNome || 'sua'} do jeito certo, ` +
        'com as informações de verdade no lugar do que eu chutei, preciso te fazer umas perguntas rápidas:',
    );
  } else {
    linhas.push(
      `Pra eu montar a página ${comNome || 'do seu negócio'} com as informações certas, ` +
        'me responde essas perguntas:',
    );
  }

  linhas.push('');
  q.perguntas.forEach((p, i) => linhas.push(`${i + 1}. ${p}`));
  linhas.push('');
  linhas.push(...FECHAMENTO);

  return linhas.join('\n');
}
