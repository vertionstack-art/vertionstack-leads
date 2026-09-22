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
  const previa = (lead.previaUrl || '').trim();
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
${previa ? `
## O TRUNFO DESTA ABORDAGEM: JÁ FIZ UMA PRÉVIA

Antes de falar com ele, publiquei um site de demonstração feito para o negócio dele, no ar agora:

${previa}

Isto muda a conversa inteira e precisa ser o centro do material que você vai montar:

- Eu não estou pedindo para ele imaginar nada. Ele clica e vê.
- Não custou nada para ele e não gera compromisso nenhum. Deixe isso explícito, senão soa como armadilha.
- É um ponto de partida, não o produto final. O site de verdade é melhor: feito com as fotos dele, os textos dele, as cores da marca dele, os serviços e preços reais — a prévia usa o que dava para montar de fora.
- Tudo é personalizável: cores, seções, fotos, textos, o que entra e o que sai.
- Mostra que eu já investi trabalho antes de cobrar qualquer coisa.

**Como usar isso sem parecer exagero:** mande o link cedo na conversa, mas não prometa que está perfeito. O tom é "montei uma ideia rápida para você ver como ficaria — e o que a gente faz de verdade fica bem acima disso". Convide-o a apontar o que mudaria; a crítica dele vira briefing e vira venda.
` : ''}

## QUEM VAI LER A MENSAGEM QUASE NUNCA É O DONO

O número do Google é o número do balcão. Quem responde é a recepcionista, a
secretária, o barbeiro que está livre, o filho que cuida do celular. Essa
pessoa não decide nada, não tem interesse nenhum em comprar site, e o
trabalho dela é despachar quem está vendendo.

Tudo que você escrever precisa sobreviver a isso:

- **Nunca venda para quem atendeu.** Explicar serviço, preço ou benefício
  para o atendente só faz ele responder "não temos interesse" antes de o
  dono saber que alguém falou.
- **Dê a ele um motivo para repassar.** Ele repassa o que parece
  importante ou o que parece interessante demais para segurar. Não repassa
  proposta comercial.
- **Não peça para falar com o responsável logo de cara.** "Gostaria de
  falar com o responsável pelo marketing" é a frase mais reconhecível de
  telemarketing que existe, e derruba a conversa na primeira linha.
- **Escreva de um jeito que o atendente consiga repassar sem entender.**
  Se ele precisa explicar o que é para o chefe, ele não repassa.
- Se der para descobrir o nome do dono, use. Perguntar "o João está?"
  passa por quem "quero falar com o responsável" não passa.

## O QUE EU PRECISO QUE VOCÊ MONTE

**1. Briefing do negócio**
O que você consegue inferir sobre esse comércio: perfil de cliente, ticket médio provável, como as pessoas costumam procurar esse tipo de serviço, e o que costuma pesar na decisão de compra nesse ramo.

**2. Diagnóstico honesto**
O que ele está perdendo hoje, em termos concretos. Se der para estimar (busca mensal na região, taxa de conversão típica), estime — e deixe claro que é estimativa.

**3. O ângulo da conversa**
Qual é a primeira frase. O que abre a porta com esse dono específico, considerando o cuidado apontado acima.

**4. Três mensagens de WhatsApp**

Curtas, no máximo 4 linhas cada, em português brasileiro informal mas profissional. Sem "espero que esteja bem". Sem parecer robô ou disparo em massa. Lembre que quem lê é o atendente, não o dono.

**A abertura tem que provocar curiosidade, não explicar.** O que funciona é dizer que existe uma coisa feita com o nome do negócio e que eu quero mostrar — sem contar o que é. Na linha desse tipo:

- "oi! montei uma coisa aqui com o nome da ${lead.name} e queria mostrar pra vocês"
- "fiz uma coisa pra ${lead.name} esses dias, posso te mandar pra dar uma olhada?"
- "tenho uma coisa pronta aqui com a cara da ${lead.name}, quem é que vê essas coisas aí?"

Use essa ideia, mas **escreva as suas próprias versões** — não copie essas três frases. Elas só mostram o tom.

Por que funciona: ninguém resiste a saber o que foi feito com o nome do próprio negócio. A pergunta "o quê?" é a resposta que eu quero, e ela vem do atendente também — que aí repassa por curiosidade, não porque entendeu a proposta.

O que não pode aparecer em nenhuma delas:
- a palavra "site", "landing page", "orçamento", "proposta" ou "serviço" na primeira mensagem
- qualquer coisa que soe como oferta; no momento em que soa, vira disparo em massa
- pedir para falar com o responsável

As três, por ângulo:
- **uma de pura curiosidade**, que não entrega nada e só quer a resposta
- **uma de curiosidade${previa ? ' que já manda o link junto' : ' um pouco mais concreta'}**, para quando eu não quiser esperar resposta
- **uma que avisa de um problema**, para quando o diagnóstico acima for forte o bastante para abrir sozinho a conversa

**Junto com as três, escreva a resposta para "o que é?"** — é a mensagem que decide tudo, e é onde eu finalmente digo do que se trata. Curta, sem empolgação, e já levando ao próximo passo.${previa ? `

É nessa resposta que entra o link, escrito exatamente assim: ${previa}

Vale também escrever a versão dela para quando quem perguntou "o que é?" foi o atendente, e não o dono: aí a resposta precisa dar a ele algo fácil de repassar, sem virar explicação técnica.` : ''}

**5. Roteiro de ligação**
Comece pelo começo de verdade: **quem atende o telefone não é o dono**. Escreva primeiro as duas ou três frases para passar por essa pessoa — o que dizer, o que não dizer, e o que responder ao "ele não está, pode deixar recado" e ao "manda por e-mail que a gente vê". Só depois disso vem a abertura com o dono, em até 15 segundos, 3 perguntas que fazem ele perceber sozinho o problema, e como encaminhar para uma proposta. Escreva como fala, não como texto.${previa ? ' Inclua o momento exato de dizer que já existe uma prévia pronta e como conduzir para ele abrir o link ainda durante a ligação — e o que dizer enquanto ele estiver olhando.' : ''}

**6. As cinco objeções mais prováveis**
Com a resposta para cada uma. Inclua obrigatoriamente "não tenho dinheiro agora", "meu Instagram já dá conta" e "vou pensar". Inclua também as duas que vêm de quem atendeu e não decide: "não temos interesse" (dito antes de o dono saber de nada) e "manda o material por e-mail que eu repasso".${previa ? ' Inclua também as que a prévia costuma provocar: "não gostei desse layout", "isso aí é template pronto?" e "por que você fez isso de graça, qual é a pegadinha?".' : ''}

**7. Proposta**
O que oferecer nesse caso, com escopo enxuto e faixa de preço em reais realista para o Brasil. Sugira também uma isca inicial mais barata, para começar a relação.

**8. ${previa ? 'Mensagem de retomada' : 'Quando insistir'}**
${previa ? 'Uma mensagem curta para mandar dois ou três dias depois, caso ele tenha aberto a prévia e não respondido. Sem cobrança e sem "passando para saber se viu".' : 'Como e quando fazer o segundo contato de quem não respondeu, sem parecer insistência.'}

**9. O que descobrir antes de ligar**
Lista curta do que eu deveria olhar (Instagram dele, concorrentes que aparecem na frente, movimento da região) para chegar preparado.

Responda direto, em português do Brasil, no formato acima. Nada de introdução nem de resumo no final.`;
}
