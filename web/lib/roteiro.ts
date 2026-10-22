/**
 * O roteiro da conversa no WhatsApp: do primeiro "oi" até a venda, passando
 * pelo atendente que precisa levar ao dono. Cada passo tem uma ou mais
 * mensagens prontas, com os marcadores de lib/mensagem ({comercio},
 * {problema}, {previa}...) e mais alguns daqui ({saudacao}, {proposta},
 * {do_time}).
 *
 * Regra da casa: nenhuma mensagem promete número, resultado ou prazo. Onde
 * é preciso um dado que só a pessoa sabe (dia da chamada, valor), o texto
 * traz [entre colchetes] para ela trocar antes de enviar.
 *
 * Roda no navegador e no servidor (a IA recebe os mesmos ids de passo e de
 * objeção, para dizer em que ponto a conversa está).
 */

export interface MensagemRoteiro {
  id: string;
  rotulo: string;
  texto: string;
}

export interface Passo {
  id: string;
  titulo: string;
  /** o que este passo precisa conseguir */
  objetivo: string;
  mensagens: MensagemRoteiro[];
}

export interface Fase {
  id: string;
  titulo: string;
  /** quando usar esta fase */
  quando: string;
  cor: 'ceu' | 'manteiga' | 'lavanda' | 'rosa' | 'menta' | 'zinco';
  passos: Passo[];
}

export interface Objecao {
  id: string;
  /** o que o cliente costuma dizer */
  frase: string;
  dica: string;
  resposta: string;
}

/** a mensagem automática da ficha (mensagemPronta), que muda com o motivo do lead */
export const MENSAGEM_AUTOMATICA = '{mensagem_automatica}';

export const FASES: Fase[] = [
  {
    id: 'abertura',
    titulo: 'Primeiro contato',
    quando: 'Ninguém respondeu ainda.',
    cor: 'ceu',
    passos: [
      {
        id: 'primeira',
        titulo: 'Primeira mensagem',
        objetivo: 'Abrir a conversa com o motivo real deste comércio.',
        mensagens: [
          { id: 'auto', rotulo: 'Pelo motivo do lead', texto: MENSAGEM_AUTOMATICA },
          {
            id: 'curta',
            rotulo: 'Curta, perguntando pelo responsável',
            texto: '{saudacao}, tudo bem? Aqui é {eu}{do_time}. Esse é o WhatsApp da {comercio}? Queria falar com quem cuida da divulgação de vocês.',
          },
          // tem site, mas fraco: a ferramenta não mede lentidão nem visual, por isso quem escolhe é a pessoa, depois de olhar o site
          {
            id: 'site_antigo',
            rotulo: 'Tem site, mas antigo ou feio',
            texto: '{saudacao}! Aqui é {eu}{do_time}. Dei uma olhada no site da {comercio} e acho que dá para deixar ele bem mais moderno e fácil de usar no celular. Montei uma ideia de como poderia ficar. Posso te mostrar?',
          },
          {
            id: 'site_lento',
            rotulo: 'Tem site, mas lento (confira antes)',
            texto: 'Oi, tudo certo? Aqui é {eu}{do_time}. Tentei abrir o site da {comercio} pelo celular e ele demorou bastante para carregar. Muita gente desiste antes de a página abrir. Fiz uma ideia de uma versão mais leve e rápida, quer ver?',
          },
          {
            id: 'site_sem_contato',
            rotulo: 'Tem site, mas difícil de chamar no WhatsApp',
            texto: 'Olá! Aqui é {eu}{do_time}. Entrei no site da {comercio} e senti falta de um jeito rápido de chamar vocês no WhatsApp ou pedir orçamento. É ali que muito cliente acaba desistindo. Posso te mostrar uma ideia?',
          },
          {
            id: 'site_google',
            rotulo: 'Tem site, mas não aparece no Google (confira antes)',
            texto: 'Opa, tudo bem? Aqui é {eu}{do_time}. Pesquisei no Google pelo que vocês fazem e o site da {comercio} quase não aparece. Dá para melhorar isso. Posso te explicar como em 2 minutos?',
          },
          {
            id: 'site_bom',
            rotulo: 'Tem site bom, mas dá para vender mais',
            texto: '{saudacao}! Aqui é {eu}{do_time}. Vi o site da {comercio}, ficou bacana! Trabalho deixando sites de comércio mais focados em trazer cliente pelo Google e pelo WhatsApp. Posso te mandar umas ideias?',
          },
        ],
      },
    ],
  },
  {
    id: 'atendente',
    titulo: 'Passar pelo atendente',
    quando: 'Quem respondeu não é quem decide (recepção, atendente, funcionário).',
    cor: 'manteiga',
    passos: [
      {
        id: 'quem_decide',
        titulo: 'Descobrir quem decide',
        objetivo: 'Saber quem é o dono ou o responsável, sem vender para o atendente.',
        mensagens: [
          {
            id: 'motivo',
            rotulo: 'Motivo em uma frase',
            texto: 'Obrigado! É rapidinho: vi que {problema} e montei uma ideia para resolver. Quem decide essas coisas aí, o dono ou um gerente?',
          },
        ],
      },
      {
        id: 'pedir_contato',
        titulo: 'Pedir o contato do responsável',
        objetivo: 'Conseguir o número ou o melhor horário para falar com quem decide.',
        mensagens: [
          {
            id: 'contato',
            rotulo: 'Pedir o contato',
            texto: 'Você consegue me passar o contato dessa pessoa? Se preferir, me diz o melhor horário que eu chamo de novo por aqui.',
          },
          {
            id: 'nome',
            rotulo: 'Pedir só o nome',
            texto: 'Sem problema! Só me diz o nome do responsável, para eu falar com a pessoa certa quando chamar de novo.',
          },
        ],
      },
      {
        id: 'recado',
        titulo: 'Deixar recado',
        objetivo: 'Quando não passam o contato: o recado chega até quem decide.',
        mensagens: [
          {
            id: 'recado',
            rotulo: 'Recado com a prévia',
            texto: 'Tranquilo! Pode passar um recado para o responsável? "{meu_nome}{do_time} fez uma prévia de site para a {comercio} e quer mostrar em 15 minutos: {previa}". Meu número é este mesmo.',
          },
        ],
      },
      {
        id: 'retorno_atendente',
        titulo: 'Cobrar o retorno',
        objetivo: 'No dia seguinte, sem resposta do responsável.',
        mensagens: [
          {
            id: 'retorno',
            rotulo: 'Retomar com o atendente',
            texto: '{saudacao}! Conseguiu falar com o responsável sobre a prévia do site? Se for mais fácil, me passa o contato que eu falo direto e não te ocupo mais.',
          },
        ],
      },
    ],
  },
  {
    id: 'decisor',
    titulo: 'Falar com quem decide',
    quando: 'Você está falando com o dono, sócio ou gerente.',
    cor: 'lavanda',
    passos: [
      {
        id: 'apresentacao',
        titulo: 'Se apresentar',
        objetivo: 'Dizer quem é você e por que chamou, em poucas linhas.',
        mensagens: [
          {
            id: 'indicado',
            rotulo: 'Veio pelo atendente',
            texto: '{saudacao}, tudo bem? Aqui é {eu}{do_time}. A equipe de vocês me passou seu contato. Vi que {problema} e montei uma ideia de como resolver. Posso te mostrar?',
          },
          {
            id: 'direto',
            rotulo: 'Falando direto com o dono',
            texto: 'Que bom falar com você! Vi que {problema}. Montei uma ideia de como a {comercio} pode aparecer melhor para quem procura {ramo} em {cidade}. Posso te mostrar?',
          },
        ],
      },
      {
        id: 'descoberta',
        titulo: 'Entender o negócio',
        objetivo: 'Fazer o cliente falar: como os clientes chegam hoje e o que incomoda.',
        mensagens: [
          {
            id: 'como_chegam',
            rotulo: 'Como os clientes chegam',
            texto: 'Antes de te mostrar, uma pergunta rápida: hoje a maior parte dos clientes chega até vocês como? Indicação, Instagram ou Google?',
          },
          {
            id: 'ja_pensou',
            rotulo: 'Já pensou em ter site',
            texto: 'Vocês já pensaram em ter um site? O que fez não sair do papel até agora?',
          },
        ],
      },
    ],
  },
  {
    id: 'valor',
    titulo: 'Mostrar o valor',
    quando: 'O cliente topou ver ou fez perguntas.',
    cor: 'menta',
    passos: [
      {
        id: 'mostrar_previa',
        titulo: 'Mandar a prévia',
        objetivo: 'O cliente ver o site com o nome dele antes de falar de preço.',
        mensagens: [
          {
            id: 'previa',
            rotulo: 'Link da prévia',
            texto: 'Fiz uma prévia de como o site da {comercio} poderia ficar: {previa}\nDá uma olhada e me diz o que achou.',
          },
        ],
      },
      {
        id: 'beneficio',
        titulo: 'Explicar o ganho',
        objetivo: 'Ligar o site ao que o cliente quer: ser achado e receber contato.',
        mensagens: [
          {
            id: 'ganho',
            rotulo: 'O que muda para eles',
            texto: 'A ideia é simples: quem procurar {ramo} em {cidade} no Google encontra vocês, vê as fotos, o horário e já chama no WhatsApp com um toque.',
          },
        ],
      },
    ],
  },
  {
    id: 'call',
    titulo: 'Marcar a chamada',
    quando: 'O cliente gostou e é hora de conversar com calma.',
    cor: 'rosa',
    passos: [
      {
        id: 'convite',
        titulo: 'Convidar para a chamada',
        objetivo: 'Marcar 15 minutos, oferecendo dois horários.',
        mensagens: [
          {
            id: 'dois_horarios',
            rotulo: 'Dois horários',
            texto: 'Consigo te mostrar tudo numa chamada de 15 minutos, já com os valores. Fica melhor [hoje às 17h] ou [amanhã às 10h]?',
          },
        ],
      },
      {
        id: 'confirmar',
        titulo: 'Confirmar',
        objetivo: 'Deixar dia e hora combinados por escrito.',
        mensagens: [
          {
            id: 'confirmado',
            rotulo: 'Confirmar dia e hora',
            texto: 'Combinado! Fica marcado [dia, às hora]. Te chamo por aqui um pouco antes. Qualquer imprevisto, é só me avisar.',
          },
        ],
      },
      {
        id: 'lembrar',
        titulo: 'Lembrar no dia',
        objetivo: 'Evitar o furo.',
        mensagens: [
          {
            id: 'lembrete',
            rotulo: 'Lembrete',
            texto: '{saudacao}! Passando para lembrar da nossa conversa hoje [às hora]. Continua bom para você?',
          },
        ],
      },
    ],
  },
  {
    id: 'proposta',
    titulo: 'Proposta e fechamento',
    quando: 'Depois da chamada, ou quando o cliente pede o valor por escrito.',
    cor: 'menta',
    passos: [
      {
        id: 'enviar_proposta',
        titulo: 'Mandar a proposta',
        objetivo: 'O cliente receber o link e poder aceitar ali mesmo.',
        mensagens: [
          {
            id: 'link',
            rotulo: 'Link da proposta',
            texto: 'Como combinamos, aqui está a proposta da {comercio}, com tudo o que está incluso e o valor: {proposta}\nDá para aceitar ali mesmo, online.',
          },
        ],
      },
      {
        id: 'acompanhar',
        titulo: 'Acompanhar',
        objetivo: 'Tirar dúvidas sem pressionar.',
        mensagens: [
          {
            id: 'duvidas',
            rotulo: 'Conseguiu olhar?',
            texto: 'Conseguiu olhar a proposta? Ficou alguma dúvida que eu possa tirar?',
          },
        ],
      },
      {
        id: 'fechar',
        titulo: 'Fechar e começar',
        objetivo: 'Combinar o próximo passo concreto depois do sim.',
        mensagens: [
          {
            id: 'comecar',
            rotulo: 'Pedir o material',
            texto: 'Que ótimo, vamos começar! Para o site, preciso de: a logo (se tiver), algumas fotos e os principais serviços de vocês. Pode me mandar por aqui mesmo.',
          },
        ],
      },
    ],
  },
  {
    id: 'sem_resposta',
    titulo: 'Sem resposta',
    quando: 'O cliente parou de responder.',
    cor: 'zinco',
    passos: [
      {
        id: 'fu1',
        titulo: 'Depois de 2 dias',
        objetivo: 'Lembrar sem cobrar.',
        mensagens: [
          { id: 'fu1', rotulo: 'Lembrete leve', texto: '{saudacao}! Conseguiu ver minha mensagem sobre o site da {comercio}?' },
        ],
      },
      {
        id: 'fu2',
        titulo: 'Depois de 5 dias',
        objetivo: 'Dar um motivo novo para responder.',
        mensagens: [
          {
            id: 'fu2',
            rotulo: 'A prévia continua lá',
            texto: 'Passando só para não te deixar sem retorno: a prévia continua aqui {previa}\nSe não for o momento, sem problema, é só me dizer.',
          },
        ],
      },
      {
        id: 'fu3',
        titulo: 'Encerrar com educação',
        objetivo: 'Sair da conversa deixando a porta aberta.',
        mensagens: [
          {
            id: 'fu3',
            rotulo: 'Despedida',
            texto: 'Vou parar de te chamar por aqui para não incomodar. Se em algum momento quiserem um site, é só me chamar. Sucesso para a {comercio}!',
          },
        ],
      },
    ],
  },
];

export const OBJECOES: Objecao[] = [
  {
    id: 'quanto_custa',
    frase: 'Quanto custa?',
    dica: 'Não solte o preço seco: leve para a chamada ou para a proposta.',
    resposta: 'Depende do que a {comercio} precisa, por isso prefiro montar a proposta certinha e te mostrar numa chamada de 15 minutos. Fica melhor [hoje] ou [amanhã]?',
  },
  {
    id: 'caro',
    frase: 'Tá caro',
    dica: 'Pergunte o que pesa e ofereça uma versão menor, sem baixar o preço do mesmo pacote.',
    resposta: 'Entendo. Dá para começar só com o essencial e crescer depois. Quer que eu te mostre uma versão mais enxuta?',
  },
  {
    id: 'instagram',
    frase: 'Já tenho Instagram',
    dica: 'Instagram e site não competem: um é para quem já segue, o outro para quem está procurando.',
    resposta: 'O Instagram é ótimo para quem já segue vocês. O site é para quem ainda não conhece e está procurando {ramo} no Google agora. Um completa o outro, e o Instagram de vocês entra dentro do site.',
  },
  {
    id: 'ja_tem_site',
    frase: 'Já tenho site',
    dica: 'Use o problema que a ferramenta achou no site.',
    resposta: 'Que bom! Dei uma olhada e vi que {problema}. Se quiser, te mostro o que dá para melhorar sem começar do zero.',
  },
  {
    id: 'sem_tempo',
    frase: 'Não tenho tempo',
    dica: 'Mostre que o trabalho é seu, não dele.',
    resposta: 'Super entendo, por isso eu cuido de tudo. De vocês, preciso só de 15 minutos numa chamada e de algumas fotos. Qual o melhor horário nesta semana?',
  },
  {
    id: 'vou_pensar',
    frase: 'Vou pensar',
    dica: 'Descubra o que falta para decidir.',
    resposta: 'Claro! Para te ajudar a pensar: o que pesa mais para você hoje, o valor ou saber se vai trazer cliente? Assim te mando a informação certa.',
  },
  {
    id: 'socio',
    frase: 'Preciso falar com meu sócio',
    dica: 'Facilite a conversa entre eles ou inclua o sócio.',
    resposta: 'Perfeito. Quer que eu prepare um resumo curto para você mostrar? Ou, se preferir, marcamos uma chamada rápida com vocês dois.',
  },
  {
    id: 'manda_aqui',
    frase: 'Manda por aqui',
    dica: 'Mande, mas faça 2 perguntas antes, para a proposta sair certa.',
    resposta: 'Claro, te mando! Só preciso de 2 respostas rápidas para montar certinho: vocês querem mais gente achando vocês no Google ou mais pedidos pelo WhatsApp? E já têm logo?',
  },
  {
    id: 'sem_interesse',
    frase: 'Não tenho interesse',
    dica: 'Agradeça e entenda o motivo, sem insistir.',
    resposta: 'Sem problema, obrigado pela sinceridade! Só por curiosidade: é porque já resolveram isso de outro jeito ou porque não é prioridade agora?',
  },
  {
    id: 'quem_e_voce',
    frase: 'Quem é você? / Como achou meu número?',
    dica: 'Seja transparente: o número está no Google.',
    resposta: 'Desculpa não ter me apresentado direito! Sou {eu}{do_time} e trabalho com sites para comércios da região. Achei a {comercio} pesquisando no Google e vi que {problema}.',
  },
  {
    id: 'conhecido',
    frase: 'Um conhecido faz para mim',
    dica: 'Não brigue com o conhecido. Deixe a porta aberta.',
    resposta: 'Que bom ter alguém de confiança! Se em algum momento quiserem uma segunda opinião ou uma proposta para comparar, fico à disposição.',
  },
  {
    id: 'depois',
    frase: 'Agora não, mais pra frente',
    dica: 'Combine quando voltar e marque um lembrete.',
    resposta: 'Combinado! Posso te chamar de novo em [data]? Já deixo anotado aqui.',
  },
];

export const TODOS_OS_PASSOS: Passo[] = FASES.flatMap((f) => f.passos);

export function passoPorId(id: string | null | undefined): Passo | null {
  return TODOS_OS_PASSOS.find((p) => p.id === id) || null;
}

export function faseDoPasso(id: string): Fase | null {
  return FASES.find((f) => f.passos.some((p) => p.id === id)) || null;
}

/** "Bom dia" / "Boa tarde" / "Boa noite", pela hora de Brasília */
export function saudacao(agora = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(agora));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** o roteiro em texto, para a IA saber os ids e o caminho da conversa */
export function roteiroEmTexto(): string {
  const fases = FASES.map(
    (f) =>
      `## ${f.titulo} (${f.quando})\n` +
      f.passos.map((p) => `- passo "${p.id}": ${p.titulo}. Objetivo: ${p.objetivo}\n  Exemplo: ${p.mensagens[0].texto}`).join('\n'),
  ).join('\n\n');
  const obj = OBJECOES.map((o) => `- objeção "${o.id}": "${o.frase}". Como lidar: ${o.dica} Exemplo: ${o.resposta}`).join('\n');
  return `${fases}\n\n## Objeções comuns\n${obj}`;
}
