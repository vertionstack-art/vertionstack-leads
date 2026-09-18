/**
 * O que a Vertion vende, quanto custa e quanto sobra.
 *
 * Cada item guarda o preço cheio e o custo real. O custo existe porque
 * alguns itens saem do bolso todo mês ou todo ano — domínio é o caso
 * clássico: o cliente acha que veio de brinde, e vem mesmo, mas alguém
 * paga o registro. Sem esse número na conta, é fácil fechar negócio no
 * prejuízo achando que está barganhando bem.
 */

export type Familia = 'presenca' | 'conversao' | 'encontrar' | 'conteudo' | 'infra' | 'recorrente' | 'cortesia';

/**
 * Os ramos que a prospecção alcança.
 *
 * Existe porque cardápio com QR Code não se oferece para imobiliária e
 * vitrine de imóveis não se oferece para pizzaria. Sem esta divisão, a
 * lista de marcação vira um cardápio de 30 itens onde metade não cabe,
 * e o risco é oferecer na proposta uma coisa que o dono nem entende.
 */
export type Ramo =
  | 'beleza'
  | 'alimentacao'
  | 'saude'
  | 'fitness'
  | 'imobiliario'
  | 'servicos'
  | 'varejo'
  | 'turismo';

export const RAMOS: Record<Ramo, string> = {
  beleza: 'Barbearia, salão, estética',
  alimentacao: 'Restaurante, pizzaria, padaria, café',
  saude: 'Clínica, consultório, veterinária',
  fitness: 'Academia, estúdio, artes marciais',
  imobiliario: 'Imobiliária, corretor, construtora',
  servicos: 'Oficina, serralheria, reformas',
  varejo: 'Loja, ótica, boutique',
  turismo: 'Agência de viagem, pousada',
};

/**
 * Descobre o ramo a partir da categoria que o Google Maps devolveu.
 *
 * O Maps escreve livre — "Barbearia", "Salão de beleza masculino",
 * "Barbeiro" — então casa por pedaço de palavra, não por igualdade.
 * Sem correspondência devolve null, e aí nada é filtrado: melhor
 * mostrar tudo do que esconder o item certo por não ter reconhecido.
 */
export function ramoDaCategoria(categoria: string | null | undefined): Ramo | null {
  const c = (categoria || '').toLowerCase();
  if (!c) return null;

  if (/barbear|cabelei|salão|salao|beleza|estétic|estetic|manicure|unha|depila|sobrancelh/.test(c)) return 'beleza';
  if (/pizza|hamburgu|lanche|restaurante|comida|food|cafeteria|café|cafe|padaria|doceria|açaí|acai|sorvete|bar|pastel|marmit|churrasc/.test(c))
    return 'alimentacao';
  if (/clínic|clinic|odonto|dentist|médic|medic|saúde|saude|psic|fisio|veterin|nutri|laborat|farmác|farmac|consultóri|consultori/.test(c))
    return 'saude';
  if (/academia|fitness|crossfit|pilates|yoga|luta|jiu|muay|natação|natacao|dança|danca|personal/.test(c)) return 'fitness';
  if (/imobiliá|imobilia|imóve|imove|corretor|constru|loteament|terren/.test(c)) return 'imobiliario';
  if (/oficina|mecânic|mecanic|funilar|borrach|serralh|marcenar|elétric|eletric|encanad|reforma|pintur|vidraç|vidrac|chavei|dedetiz|limpez|advog|contab/.test(c))
    return 'servicos';
  if (/ótica|otica|loja|boutique|roupa|calçad|calcad|joalher|papelar|presente|móvei|movei|pet shop|petshop|materiais|distribuid|mercad/.test(c))
    return 'varejo';
  if (/viage|turis|hotel|pousada|passeio|hosped|chalé|chale/.test(c)) return 'turismo';

  return null;
}

export interface Servico {
  id: string;
  nome: string;
  familia: Familia;
  /** o que dizer ao cliente — benefício, não característica técnica */
  beneficio: string;
  preco: number;
  /** quanto isso custa para você, por projeto ou por mês */
  custo: number;
  /** true = cobrança mensal; false = uma vez só */
  mensal?: boolean;
  /**
   * Aparece como cortesia no documento do cliente, mas o preço entra na
   * conta normalmente. É o velho truque de embutir: o comerciante lê
   * "incluso" e sente que ganhou algo, e você não trabalha de graça.
   * O valor cheio continua visível para você aqui dentro.
   */
  brinde?: boolean;
  /** itens que não fazem sentido juntos (ex.: dois tipos de site) */
  conflitaCom?: string[];
  /** sugestão de em qual plano este item costuma entrar */
  sugerido?: 'basico' | 'intermediario' | 'avancado';
  /**
   * Ramos onde este item faz sentido. Ausente = serve para todos, que é
   * o caso da maioria — só os itens realmente específicos listam ramo.
   */
  ramos?: Ramo[];
}

/** Um item cabe no lead quando não tem ramo declarado, ou quando o ramo bate. */
export function serveAoRamo(servico: Servico, ramo: Ramo | null): boolean {
  if (!servico.ramos) return true;
  if (!ramo) return true; // categoria desconhecida: não esconde nada
  return servico.ramos.includes(ramo);
}

export const FAMILIAS: Record<Familia, { titulo: string; explicacao: string }> = {
  presenca: {
    titulo: 'O que vai ser feito',
    explicacao:
      'Pode marcar mais de um: uma landing para campanha e uma loja virtual são entregas diferentes, e somam.',
  },
  conversao: {
    titulo: 'Transformar visita em cliente',
    explicacao: 'Onde está o dinheiro para o comerciante: quem entra no site precisa virar contato.',
  },
  encontrar: {
    titulo: 'Ser encontrado',
    explicacao: 'De nada adianta um site bonito que ninguém acha.',
  },
  conteudo: {
    titulo: 'Conteúdo e visual',
    explicacao: 'O que costuma travar a entrega: cliente que não manda texto nem foto.',
  },
  infra: {
    titulo: 'Infraestrutura',
    explicacao: 'O que faz o site existir. Boa parte é barata para você e vale muito para o cliente.',
  },
  recorrente: {
    titulo: 'Mensalidade',
    explicacao: 'Receita que se repete. Um cliente de R$ 120/mês vale mais que um projeto de R$ 800.',
  },
  cortesia: {
    titulo: 'Cortesias que não custam nada',
    explicacao:
      'Tudo aqui já vem junto do trabalho ou leva minutos para fazer, e mesmo assim tem valor para quem lê. Marque à vontade: não muda o preço e engorda a lista de entregas.',
  },
};

export const CATALOGO: Servico[] = [
  // ---------------------------------------------------------- presença
  {
    id: 'landing',
    nome: 'Landing page',
    familia: 'presenca',
    beneficio: 'Uma página só, feita para o cliente ligar ou chamar no WhatsApp.',
    preco: 390,
    custo: 0,
    sugerido: 'basico',
  },
  {
    id: 'site_institucional',
    nome: 'Site institucional (até 5 páginas)',
    familia: 'presenca',
    beneficio: 'Início, serviços, sobre, contato. O cartão de visita que fica no Google.',
    preco: 590,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'site_catalogo',
    nome: 'Site com catálogo ou cardápio',
    familia: 'presenca',
    beneficio: 'Produtos e preços que você mesmo atualiza, sem depender de ninguém.',
    preco: 890,
    custo: 0,
    sugerido: 'avancado',
  },
  {
    id: 'loja_virtual',
    nome: 'Loja virtual',
    familia: 'presenca',
    beneficio: 'Venda direto pelo site, com pagamento online.',
    preco: 1490,
    custo: 0,
  },
  {
    id: 'sistema',
    nome: 'Sistema sob medida',
    familia: 'presenca',
    beneficio: 'Feito para o jeito que o negócio funciona — ordem de serviço, ficha de cliente, controle interno.',
    preco: 2400,
    custo: 0,
  },
  {
    id: 'dashboard',
    nome: 'Painel de controle',
    familia: 'presenca',
    beneficio: 'Os números do negócio numa tela só, atualizados sozinhos.',
    preco: 1200,
    custo: 0,
  },

  // --------------------------------------------------------- conversão
  {
    id: 'whatsapp',
    nome: 'Botão de WhatsApp com mensagem pronta',
    familia: 'conversao',
    beneficio: 'O cliente clica e a conversa já abre escrita. Some a barreira de "o que eu digo".',
    preco: 30,
    custo: 0,
    sugerido: 'basico',
    brinde: true,
  },
  {
    id: 'form_orcamento',
    nome: 'Formulário de orçamento',
    familia: 'conversao',
    beneficio: 'Pedido chega no seu e-mail e no WhatsApp, já com as informações que você precisa perguntar.',
    preco: 70,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'agendamento',
    nome: 'Agendamento online',
    familia: 'conversao',
    beneficio: 'O cliente marca horário sozinho, inclusive de madrugada, sem ocupar seu atendente.',
    preco: 150,
    custo: 0,
    sugerido: 'avancado',
  },
  {
    id: 'auto_whatsapp',
    nome: 'Atendimento automático no WhatsApp',
    familia: 'conversao',
    beneficio: 'Responde na hora as perguntas de sempre — preço, horário, endereço — mesmo fechado.',
    preco: 200,
    custo: 0,
    sugerido: 'avancado',
  },
  {
    id: 'crm',
    nome: 'Lista de contatos organizada',
    familia: 'conversao',
    beneficio: 'Todo mundo que pediu orçamento fica registrado, para você retomar depois.',
    preco: 120,
    custo: 0,
  },

  {
    id: 'cardapio_qr',
    nome: 'Cardápio digital com QR Code',
    familia: 'conversao',
    beneficio:
      'Um código na mesa que abre o cardápio no celular do cliente. Trocar preço leva um minuto e não custa gráfica.',
    preco: 180,
    custo: 0,
    ramos: ['alimentacao'],
    sugerido: 'intermediario',
  },

  // ------------------------------------------------------ ser achado
  {
    id: 'seo',
    nome: 'Otimização para o Google',
    familia: 'encontrar',
    beneficio: 'O site preparado para aparecer quando alguém procura seu serviço na sua região.',
    preco: 120,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'gmn',
    nome: 'Perfil do Google Meu Negócio arrumado',
    familia: 'encontrar',
    beneficio: 'É por ali que a maioria acha você. Fotos, horário, serviços e o link certo do site.',
    preco: 80,
    custo: 0,
    sugerido: 'basico',
  },
  {
    id: 'analytics',
    nome: 'Relatório de visitas',
    familia: 'encontrar',
    beneficio: 'Saber quantas pessoas entraram, de onde vieram e o que procuraram.',
    preco: 40,
    custo: 0,
    sugerido: 'intermediario',
  },

  // --------------------------------------------------------- conteúdo
  {
    id: 'textos',
    nome: 'Escrita dos textos',
    familia: 'conteudo',
    beneficio: 'Você não precisa escrever nada. A gente escreve e você aprova.',
    preco: 100,
    custo: 0,
    sugerido: 'intermediario',
    brinde: true,
  },
  {
    id: 'identidade',
    nome: 'Ajuste de identidade visual',
    familia: 'conteudo',
    beneficio: 'Cores, tipografia e logo em ordem, para o site não parecer de outra empresa.',
    preco: 150,
    custo: 0,
  },
  {
    id: 'fotos',
    nome: 'Tratamento de fotos',
    familia: 'conteudo',
    beneficio: 'As fotos que você já tem, recortadas e tratadas para não deixarem o site feio.',
    preco: 100,
    custo: 0,
    brinde: true,
  },

  {
    id: 'blog',
    nome: 'Área de novidades (blog)',
    familia: 'conteudo',
    beneficio:
      'Um espaço onde você mesmo publica promoção, novidade ou dica. O Google gosta de site que se mexe, e o cliente volta para ver.',
    preco: 220,
    custo: 0,
  },

  // ----------------------------------------------------------- infra
  {
    id: 'dominio',
    nome: 'Domínio próprio incluso',
    familia: 'infra',
    beneficio: 'Endereço com o nome do seu negócio, o ano todo por nossa conta.',
    preco: 0,
    custo: 45,
    sugerido: 'basico',
  },
  {
    id: 'hospedagem',
    nome: 'Hospedagem e certificado de segurança',
    familia: 'infra',
    beneficio: 'Site no ar, rápido, com o cadeado verde que o cliente confia.',
    preco: 0,
    custo: 0,
    sugerido: 'basico',
  },
  {
    id: 'email',
    nome: 'E-mail profissional',
    familia: 'infra',
    beneficio: 'contato@suaempresa.com.br no lugar do Gmail. Muda como o cliente te vê.',
    preco: 80,
    custo: 0,
    sugerido: 'intermediario',
  },

  // ------------------------------------------------------ recorrente
  {
    id: 'manutencao',
    nome: 'Manutenção mensal',
    familia: 'recorrente',
    beneficio: 'Site no ar, backup, segurança em dia e conserto se algo quebrar.',
    preco: 97,
    custo: 4,
    mensal: true,
    sugerido: 'basico',
  },
  {
    id: 'atualizacoes',
    nome: 'Atualizações de conteúdo (4 por mês)',
    familia: 'recorrente',
    beneficio: 'Trocar preço, promoção, foto ou horário quando quiser, sem pagar à parte.',
    preco: 110,
    custo: 0,
    mensal: true,
    sugerido: 'intermediario',
  },
  {
    id: 'suporte_comercial',
    nome: 'Suporte em horário comercial',
    familia: 'recorrente',
    beneficio: 'Segunda a sexta, das 9h às 18h, resposta no mesmo dia útil.',
    preco: 50,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_estendido', 'suporte_24h'],
    sugerido: 'basico',
    brinde: true,
  },
  {
    id: 'suporte_estendido',
    nome: 'Suporte estendido',
    familia: 'recorrente',
    beneficio: 'Todos os dias, das 8h às 22h, inclusive fim de semana.',
    preco: 100,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_comercial', 'suporte_24h'],
    sugerido: 'avancado',
    brinde: true,
  },
  {
    id: 'suporte_24h',
    nome: 'Suporte 24 horas',
    familia: 'recorrente',
    beneficio: 'Qualquer hora, qualquer dia, com retorno em até 1 hora.',
    preco: 200,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_comercial', 'suporte_estendido'],
    brinde: true,
  },
  {
    id: 'relatorio',
    nome: 'Relatório mensal',
    familia: 'recorrente',
    beneficio: 'Todo mês um resumo do que o site trouxe de contato e visita.',
    preco: 50,
    custo: 0,
    mensal: true,
    sugerido: 'avancado',
    brinde: true,
  },

  // ------------------------------------------------------- cortesias
  /*
   * Estes nove não custam nada e quase não dão trabalho: ou já saem
   * prontos do jeito que o site é feito, ou levam minutos. Preço zero
   * de propósito — não é para faturar, é para o cliente enxergar o
   * tamanho do que está levando. Uma proposta de quatro linhas parece
   * cara; a mesma proposta com doze linhas parece barata.
   */
  {
    id: 'compartilhamento',
    nome: 'Link bonito no WhatsApp e no Instagram',
    familia: 'cortesia',
    beneficio:
      'Quando alguém manda o endereço do site numa conversa, aparece a foto e o nome do negócio — não um link seco que ninguém clica.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'favicon',
    nome: 'Ícone do negócio na aba do navegador',
    familia: 'cortesia',
    beneficio: 'Seu símbolo aparece na abinha e nos favoritos, do mesmo jeito que nas empresas grandes.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'backup',
    nome: 'Backup automático',
    familia: 'cortesia',
    beneficio: 'Cada alteração fica guardada. Se algo sair errado, o site volta a como estava em poucos minutos.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'horario_aberto',
    nome: 'Aviso de aberto ou fechado, automático',
    familia: 'cortesia',
    beneficio:
      'O site mostra sozinho "aberto agora" ou "fecha às 18h", conforme o horário do dia. Ninguém liga à toa e ninguém deixa de ir achando que fechou.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'redes_no_site',
    nome: 'Suas redes ligadas ao site',
    familia: 'cortesia',
    beneficio: 'Instagram, Facebook e WhatsApp a um toque, e o site aparecendo na bio das redes. Um puxa o outro.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'celular_antigo',
    nome: 'Funciona em celular simples',
    familia: 'cortesia',
    beneficio:
      'Testado em tela pequena e aparelho antigo, que é como boa parte dos seus clientes vai abrir. Site que trava perde venda.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'avisar_google',
    nome: 'Aviso ao Google de que o site existe',
    familia: 'cortesia',
    beneficio: 'Cadastro nas ferramentas do Google para ele encontrar e listar as páginas sem esperar meses.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'como_chegar',
    nome: 'Botão "como chegar"',
    familia: 'cortesia',
    beneficio: 'Um toque e a rota abre no mapa do celular, já traçada até a sua porta.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
  {
    id: 'garantia_30',
    nome: 'Ajustes sem custo nos primeiros 30 dias',
    familia: 'cortesia',
    beneficio: 'Errou um preço, quer trocar uma foto, mudou o horário: no primeiro mês a gente acerta sem cobrar.',
    preco: 0,
    custo: 0,
    brinde: true,
  },
];

export const porId = (id: string) => CATALOGO.find((s) => s.id === id);

// ------------------------------------------------------------- porte

export type Porte = 'micro' | 'pequena' | 'media' | 'grande';
export type Formalizacao = 'mei' | 'simples' | 'ltda' | 'desconhecido';

/**
 * O quanto o preço acompanha o tamanho do cliente.
 *
 * Não é ganância: é que uma barbearia de cadeira única e uma rede com
 * cinco lojas têm capacidade de pagamento muito diferente, e cobrar igual
 * dos dois significa ou perder a pequena ou deixar dinheiro na mesa com a
 * grande. O trabalho também não é o mesmo — empresa maior traz mais
 * reunião, mais aprovação e mais gente para agradar.
 */
export const PORTES: Record<Porte, { titulo: string; descricao: string; fator: number }> = {
  micro: {
    titulo: 'Micro',
    descricao: 'Dono sozinho ou com um ajudante. Barbearia de uma cadeira, lanchonete de bairro.',
    fator: 1,
  },
  pequena: {
    titulo: 'Pequena',
    descricao: 'De 3 a 10 funcionários, um ponto. Clínica pequena, restaurante de rua.',
    fator: 1.35,
  },
  media: {
    titulo: 'Média',
    descricao: 'Mais de 10 pessoas, ou duas unidades. Academia com estrutura, imobiliária com equipe.',
    fator: 1.85,
  },
  grande: {
    titulo: 'Grande',
    descricao: 'Rede, franquia ou empresa consolidada, com setor de marketing.',
    fator: 2.6,
  },
};

export const FORMALIZACOES: Record<Formalizacao, { titulo: string; dica: string; fator: number }> = {
  desconhecido: {
    titulo: 'Não sei ainda',
    dica: 'Dá para perguntar na conversa: "vocês são MEI ou já têm CNPJ maior?".',
    fator: 1,
  },
  mei: {
    titulo: 'MEI',
    dica: 'Fatura até R$ 81 mil por ano. Orçamento curto, mas decisão rápida — quem decide é quem atende você.',
    fator: 0.92,
  },
  simples: {
    titulo: 'Simples Nacional',
    dica: 'Já tem contador e alguma folga no caixa. É a faixa dos melhores clientes.',
    fator: 1,
  },
  ltda: {
    titulo: 'Empresa maior',
    dica: 'Vai pedir nota, contrato e prazo. Aceita valor maior, mas a decisão demora mais.',
    fator: 1.15,
  },
};
