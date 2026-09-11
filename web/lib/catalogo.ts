/**
 * O que a Vertion vende, quanto custa e quanto sobra.
 *
 * Cada item guarda o preço cheio e o custo real. O custo existe porque
 * alguns itens saem do bolso todo mês ou todo ano — domínio é o caso
 * clássico: o cliente acha que veio de brinde, e vem mesmo, mas alguém
 * paga o registro. Sem esse número na conta, é fácil fechar negócio no
 * prejuízo achando que está barganhando bem.
 */

export type Familia = 'presenca' | 'conversao' | 'encontrar' | 'conteudo' | 'infra' | 'recorrente';

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
  /** itens que não fazem sentido juntos (ex.: dois tipos de site) */
  conflitaCom?: string[];
  /** sugestão de em qual plano este item costuma entrar */
  sugerido?: 'basico' | 'intermediario' | 'avancado';
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
    preco: 60,
    custo: 0,
    sugerido: 'basico',
  },
  {
    id: 'form_orcamento',
    nome: 'Formulário de orçamento',
    familia: 'conversao',
    beneficio: 'Pedido chega no seu e-mail e no WhatsApp, já com as informações que você precisa perguntar.',
    preco: 90,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'agendamento',
    nome: 'Agendamento online',
    familia: 'conversao',
    beneficio: 'O cliente marca horário sozinho, inclusive de madrugada, sem ocupar seu atendente.',
    preco: 190,
    custo: 0,
    sugerido: 'avancado',
  },
  {
    id: 'auto_whatsapp',
    nome: 'Atendimento automático no WhatsApp',
    familia: 'conversao',
    beneficio: 'Responde na hora as perguntas de sempre — preço, horário, endereço — mesmo fechado.',
    preco: 240,
    custo: 0,
    sugerido: 'avancado',
  },
  {
    id: 'crm',
    nome: 'Lista de contatos organizada',
    familia: 'conversao',
    beneficio: 'Todo mundo que pediu orçamento fica registrado, para você retomar depois.',
    preco: 150,
    custo: 0,
  },

  // ------------------------------------------------------ ser achado
  {
    id: 'seo',
    nome: 'Otimização para o Google',
    familia: 'encontrar',
    beneficio: 'O site preparado para aparecer quando alguém procura seu serviço na sua região.',
    preco: 140,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'gmn',
    nome: 'Perfil do Google Meu Negócio arrumado',
    familia: 'encontrar',
    beneficio: 'É por ali que a maioria acha você. Fotos, horário, serviços e o link certo do site.',
    preco: 110,
    custo: 0,
    sugerido: 'basico',
  },
  {
    id: 'analytics',
    nome: 'Relatório de visitas',
    familia: 'encontrar',
    beneficio: 'Saber quantas pessoas entraram, de onde vieram e o que procuraram.',
    preco: 60,
    custo: 0,
    sugerido: 'intermediario',
  },

  // --------------------------------------------------------- conteúdo
  {
    id: 'textos',
    nome: 'Escrita dos textos',
    familia: 'conteudo',
    beneficio: 'Você não precisa escrever nada. A gente escreve e você aprova.',
    preco: 130,
    custo: 0,
    sugerido: 'intermediario',
  },
  {
    id: 'identidade',
    nome: 'Ajuste de identidade visual',
    familia: 'conteudo',
    beneficio: 'Cores, tipografia e logo em ordem, para o site não parecer de outra empresa.',
    preco: 180,
    custo: 0,
  },
  {
    id: 'fotos',
    nome: 'Tratamento de fotos',
    familia: 'conteudo',
    beneficio: 'As fotos que você já tem, recortadas e tratadas para não deixarem o site feio.',
    preco: 120,
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
    preco: 60,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_estendido', 'suporte_24h'],
    sugerido: 'basico',
  },
  {
    id: 'suporte_estendido',
    nome: 'Suporte estendido',
    familia: 'recorrente',
    beneficio: 'Todos os dias, das 8h às 22h, inclusive fim de semana.',
    preco: 150,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_comercial', 'suporte_24h'],
    sugerido: 'avancado',
  },
  {
    id: 'suporte_24h',
    nome: 'Suporte 24 horas',
    familia: 'recorrente',
    beneficio: 'Qualquer hora, qualquer dia, com retorno em até 1 hora.',
    preco: 340,
    custo: 0,
    mensal: true,
    conflitaCom: ['suporte_comercial', 'suporte_estendido'],
  },
  {
    id: 'relatorio',
    nome: 'Relatório mensal',
    familia: 'recorrente',
    beneficio: 'Todo mês um resumo do que o site trouxe de contato e visita.',
    preco: 60,
    custo: 0,
    mensal: true,
    sugerido: 'avancado',
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
