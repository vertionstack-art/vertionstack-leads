/**
 * Monta o prompt de abordagem de um lead, para colar no ChatGPT.
 *
 * A parte que faz diferença é o diagnóstico: o argumento de venda para quem
 * só tem Instagram não tem nada a ver com o argumento para quem tem um site
 * fora do ar — esse segundo geralmente nem sabe que está pagando por algo
 * quebrado, e é a conversa mais fácil que existe. Por isso o prompt monta um
 * bloco de situação diferente para cada caso, em vez de despejar os campos
 * do banco e esperar que a IA adivinhe o ângulo.
 */

import type { Lead } from './db';

interface Angulo {
  resumo: string;
  porQueDoi: string;
  cuidado: string;
}

/** o diagnóstico e o gancho de conversa, conforme o que foi encontrado */
function anguloDoLead(lead: Lead): Angulo {
  // o resultado da verificação vale mais que a classificação original:
  // ele diz o que acontece quando alguém realmente tenta abrir o site
  switch (lead.siteStatus) {
    case 'fora_do_ar':
      return {
        resumo: `Tem um site cadastrado no Google (${lead.website}), mas ele NÃO ABRE. ${lead.siteDetalhe || ''}`.trim(),
        porQueDoi:
          'Todo cliente que busca no Google e clica no site cai numa página de erro. ' +
          'O dono provavelmente não sabe disso — quem descobre é o cliente, e ele vai embora para o concorrente. ' +
          'Pode ser domínio que venceu, hospedagem que parou de ser paga ou empresa que sumiu.',
        cuidado:
          'Avise sem constranger. O dono pode ter sido abandonado por quem fez o site, ou estar pagando ' +
          'mensalidade por algo que não existe mais. Chegue como quem avisa de um problema, não como quem vende.',
      };

    case 'certificado_vencido':
      return {
        resumo: `O site (${lead.website}) está com o certificado de segurança vencido.`,
        porQueDoi:
          'O navegador mostra uma tela vermelha de "site não seguro" antes de deixar entrar. ' +
          'A maioria das pessoas desiste ali. Na prática o site existe mas está invisível.',
        cuidado: 'Peça para ele mesmo abrir o site no celular. Ver o aviso vermelho vale mais que qualquer explicação.',
      };

    case 'em_construcao':
      return {
        resumo: `O endereço cadastrado (${lead.website}) abre, mas não tem conteúdo. ${lead.siteDetalhe || ''}`.trim(),
        porQueDoi:
          'É uma página vazia ou de "em construção". Quem chega tem a impressão de negócio abandonado — ' +
          'pior do que não ter site nenhum.',
        cuidado: 'Talvez tenham começado um site e nunca terminado. Descubra o que aconteceu antes de propor.',
      };

    case 'virou_social':
      return {
        resumo: `O que está cadastrado como site (${lead.website}) na verdade leva para uma rede social.`,
        porQueDoi:
          'Não é um endereço próprio. Some se a plataforma bloquear a conta, não aparece direito nas buscas do Google ' +
          'e não dá para ter catálogo, orçamento ou agendamento como se fosse dele.',
        cuidado: 'Não critique a rede social — ela funciona para eles. Posicione o site como o que falta, não como substituto.',
      };

    case 'sem_https':
      return {
        resumo: `O site (${lead.website}) funciona, mas sem HTTPS.`,
        porQueDoi:
          'O navegador marca como "não seguro" na barra de endereço. Passa desconfiança, ' +
          'e o Google rebaixa esse tipo de site nos resultados.',
        cuidado: 'É um problema pequeno e barato de resolver. Use como porta de entrada para uma conversa maior.',
      };
  }

  // sem verificação conclusiva, vale a classificação da presença digital
  switch (lead.websiteKind) {
    case 'none':
      return {
        resumo: 'Não tem site nenhum. Só a ficha do Google Maps.',
        porQueDoi:
          'Quem procura por esse tipo de serviço na região encontra os concorrentes que têm site, não ele. ' +
          'Ele depende de quem já passa na porta ou de indicação.',
        cuidado:
          'Não presuma que ele quer site "porque é moderno". Descubra como os clientes chegam hoje e onde está o gargalo.',
      };

    case 'social':
      return {
        resumo: `Só tem rede social cadastrada como site (${lead.website}).`,
        porQueDoi:
          'A audiência é alugada: depende do algoritmo e some se a conta cair. ' +
          'Não aparece bem no Google, e não dá para ter orçamento, catálogo ou agendamento próprio.',
        cuidado:
          'Se o Instagram vai bem, ele vai dizer que não precisa de site. Não brigue com isso — ' +
          'mostre o site como o lugar para onde o Instagram manda as pessoas.',
      };

    case 'marketplace':
      return {
        resumo: `A presença digital dele é uma plataforma de terceiro (${lead.website}).`,
        porQueDoi:
          'Ele paga comissão por cliente e não é dono da relação. A plataforma tem os dados, ele não. ' +
          'Se as regras ou as taxas mudarem, ele não tem para onde correr.',
        cuidado:
          'A plataforma traz cliente de verdade — não peça para largar. O ângulo é o canal próprio ao lado, ' +
          'onde a margem é inteira dele.',
      };

    case 'weak':
      return {
        resumo: `Tem um site em construtor gratuito ou página automática (${lead.website}).`,
        porQueDoi:
          'Costuma ser lento, com endereço esquisito, sem identidade e às vezes com propaganda da plataforma. ' +
          'Passa a impressão de negócio pequeno e improvisado, mesmo quando não é.',
        cuidado: 'Alguém da casa provavelmente fez esse site. Critique o resultado, nunca a pessoa.',
      };
  }

  return {
    resumo: 'Tem site próprio aparentemente funcionando.',
    porQueDoi: 'O gancho aqui não é a ausência de site, e sim o que o site atual deixa de fazer: captar contato, converter, aparecer no Google.',
    cuidado: 'Este é o lead mais difícil da lista. Só aborde com um motivo concreto — evite falar de gosto pessoal.',
  };
}

function reputacao(lead: Lead): string {
  if (!lead.rating) return 'Sem avaliações no Google.';

  const n = lead.reviews || 0;
  const nota = lead.rating.toFixed(1).replace('.', ',');

  if (n >= 300 && lead.rating >= 4.5) {
    return `${nota} estrelas em ${n} avaliações — reputação forte. ` +
      'Isso é prova social pronta que hoje não tem onde ser mostrada. Use no argumento.';
  }
  if (lead.rating < 4) {
    return `${nota} estrelas em ${n} avaliações — reputação fraca. ` +
      'Cuidado ao tocar no assunto; pode ser sensível.';
  }
  return `${nota} estrelas em ${n} avaliações.`;
}

export function montarPrompt(lead: Lead): string {
  const a = anguloDoLead(lead);
  const linha = (rotulo: string, valor: string | null | undefined) =>
    valor ? `- ${rotulo}: ${valor}` : null;

  const ficha = [
    linha('Nome', lead.name),
    linha('Ramo', lead.category),
    linha('Endereço', lead.address),
    linha('Cidade', lead.city),
    linha('Telefone', lead.phone),
    `- Reputação no Google: ${reputacao(lead)}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `Você é um consultor de vendas especializado em vender sites, landing pages e automações para pequenos e médios comércios brasileiros. Fala como gente, sem jargão de agência.

Vou abordar o comércio abaixo. Preciso do material completo para essa conversa.

## O COMÉRCIO

${ficha}

## A SITUAÇÃO DIGITAL DELE (foi verificada, não é suposição)

${a.resumo}

**Por que isso custa dinheiro para ele:**
${a.porQueDoi}

**Cuidado na abordagem:**
${a.cuidado}

## O QUE EU VENDO

Sites institucionais, landing pages e automações de atendimento (WhatsApp, agendamento, orçamento). Atendo pequenos comércios, entrego rápido e cobro preço de mercado brasileiro — não sou agência grande.

## O QUE EU PRECISO QUE VOCÊ MONTE

**1. Briefing do negócio**
O que você consegue inferir sobre esse comércio: perfil de cliente, ticket médio provável, como as pessoas costumam procurar esse tipo de serviço, e o que costuma pesar na decisão de compra nesse ramo.

**2. Diagnóstico honesto**
O que ele está perdendo hoje, em termos concretos. Se der para estimar (busca mensal na região, taxa de conversão típica), estime — e deixe claro que é estimativa.

**3. O ângulo da conversa**
Qual é a primeira frase. O que abre a porta com esse dono específico, considerando o cuidado apontado acima.

**4. Três mensagens de WhatsApp**
Curtas, no máximo 4 linhas cada, em português brasileiro informal mas profissional. Sem "espero que esteja bem". Sem parecer robô ou disparo em massa. Três ângulos diferentes:
- uma que avisa de um problema
- uma que puxa pela oportunidade
- uma bem curta e direta

**5. Roteiro de ligação**
Abertura em até 15 segundos, 3 perguntas que fazem o dono perceber sozinho o problema, e como encaminhar para uma proposta. Escreva como fala, não como texto.

**6. As cinco objeções mais prováveis**
Com a resposta para cada uma. Inclua obrigatoriamente "não tenho dinheiro agora", "meu Instagram já dá conta" e "vou pensar".

**7. Proposta**
O que oferecer nesse caso, com escopo enxuto e faixa de preço em reais realista para o Brasil. Sugira também uma isca inicial mais barata, para começar a relação.

**8. O que descobrir antes de ligar**
Lista curta do que eu deveria olhar (Instagram dele, concorrentes que aparecem na frente, movimento da região) para chegar preparado.

Responda direto, em português do Brasil, no formato acima. Nada de introdução nem de resumo no final.`;
}
