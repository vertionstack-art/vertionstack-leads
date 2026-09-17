/**
 * Prompt para construir o site de prévia de um lead.
 *
 * Diferente do prompt de abordagem, que é para conversar com o dono: este
 * vai para o assistente que vai escrever o código. Ele carrega tudo o que
 * a extensão colheu do Google Maps mais o que foi cadastrado à mão, para
 * o site já nascer com o nome certo, o telefone certo e o WhatsApp certo
 * — sem ninguém precisar redigitar nada.
 */

import type { Lead } from './db';

/**
 * O comando de instalação das skills vai literal, sem uma vírgula fora do
 * lugar. Fica numa constante justamente para nunca ser reescrito à mão
 * nem quebrado em linhas por engano.
 */
export const COMANDO_SKILLS =
  'npx claude-code-templates@latest --skill creative-design/frontend-design,development/senior-frontend,creative-design/ui-ux-pro-max,development/senior-backend,development/senior-architect,creative-design/ui-design-system,creative-design/mobile-design,productivity/humanizer';

/** só os dígitos, no formato que o link do WhatsApp aceita */
function whatsappDe(telefone: string | null): string | null {
  if (!telefone) return null;
  const d = telefone.replace(/\D/g, '');
  if (d.length < 10) return null;
  return 'https://wa.me/' + (d.startsWith('55') ? d : '55' + d);
}

/**
 * O que não pode faltar no site, conforme o tipo de comércio.
 *
 * Uma barbearia vive de agendamento; uma pizzaria, de cardápio e pedido;
 * uma clínica, de confiança e convênio. Sem isto o assistente entrega a
 * mesma página genérica para todos, que é o que faz site de pequeno
 * negócio parecer template.
 */
function focoDoRamo(categoria: string | null): string {
  const c = (categoria || '').toLowerCase();

  if (/barbearia|barbear|cabelei|salão|salao|beleza|estética|estetica|manicure/.test(c))
    return [
      '- Agendar é a ação principal: botão de horário em tudo quanto é dobra.',
      '- Galeria de cortes ou trabalhos feitos vale mais que texto — o cliente compra pelo olho.',
      '- Tabela de serviços com preço; esconder preço afasta neste ramo.',
      '- Equipe com foto e nome: as pessoas escolhem o profissional, não só o lugar.',
    ].join('\n');

  if (/pizza|hamburgu|lanche|restaurante|bar |comida|food|cafeteria|café|cafe|padaria|doceria|açaí|acai/.test(c))
    return [
      '- Cardápio com foto e preço é o coração da página. Sem foto de comida, não vende.',
      '- Pedir pelo WhatsApp em um toque, com mensagem já escrita.',
      '- Horário de funcionamento visível sem rolar a página, e se entrega ou não.',
      '- Área de entrega e tempo médio, se houver.',
    ].join('\n');

  if (/clínica|clinica|odonto|dentist|médic|medic|saúde|saude|psic|fisio|veterin|pet/.test(c))
    return [
      '- Confiança acima de tudo: especialidades, formação, registro profissional.',
      '- Convênios aceitos, se houver — é a primeira pergunta do paciente.',
      '- Agendamento de consulta em destaque, e telefone bem visível.',
      '- Tom sóbrio. Nada de promessa de resultado, que é vedado em saúde.',
    ].join('\n');

  if (/academia|fitness|crossfit|pilates|yoga|luta|jiu|muay|natação|natacao/.test(c))
    return [
      '- Modalidades e horários das turmas.',
      '- Planos e valores, ou ao menos "a partir de".',
      '- Fotos do espaço real: quem procura academia quer ver a estrutura.',
      '- Chamada para aula experimental gratuita.',
    ].join('\n');

  if (/imobiliá|imobilia|imóve|imove|corretor|constru/.test(c))
    return [
      '- Vitrine de imóveis com foto, bairro, metragem e valor.',
      '- Busca ou filtro simples por tipo e faixa de preço.',
      '- Formulário de "quero anunciar meu imóvel" além do de compra.',
      '- CRECI visível — é exigência da profissão.',
    ].join('\n');

  if (/oficina|mecânic|mecanic|auto|funilar|borracha|serralh|marcenar|elétric|eletric|encanad|reforma/.test(c))
    return [
      '- Lista clara dos serviços prestados; o cliente chega pesquisando o problema dele.',
      '- Orçamento pelo WhatsApp com foto do serviço — é assim que esse ramo negocia.',
      '- Tempo de mercado e trabalhos feitos passam a confiança que falta.',
      '- Endereço com mapa: esse cliente vai presencialmente.',
    ].join('\n');

  if (/ótica|otica|loja|boutique|roupa|calçad|calcad|joalher|papelar|presente/.test(c))
    return [
      '- Vitrine dos produtos com foto boa.',
      '- Marcas trabalhadas, que é o que o cliente procura pelo nome.',
      '- WhatsApp para consulta de disponibilidade e preço.',
      '- Endereço e horário bem visíveis.',
    ].join('\n');

  if (/viage|turis|hotel|pousada|passeio/.test(c))
    return [
      '- Destinos e pacotes com foto grande.',
      '- Formulário de cotação, que é como esse ramo capta.',
      '- Selo de cadastro no Ministério do Turismo, se houver.',
    ].join('\n');

  return [
    '- Deixe claro em cinco segundos o que o negócio faz e para quem.',
    '- Lista de serviços com uma frase de benefício em cada.',
    '- Contato por WhatsApp em destaque, em mais de um ponto da página.',
    '- Endereço, horário e mapa.',
  ].join('\n');
}

export function montarPromptSite(lead: Lead, nomeEmpresa = 'Vertion Stack'): string {
  const zap = whatsappDe(lead.phone);
  const linha = (rotulo: string, valor: string | null | undefined) => (valor ? `- **${rotulo}:** ${valor}` : null);

  const dados = [
    linha('Nome do comércio', lead.name),
    linha('Ramo', lead.category),
    linha('Endereço', lead.address),
    linha('Cidade / região', lead.city),
    linha('Telefone', lead.phone),
    linha('Link direto do WhatsApp', zap),
    linha('Instagram', lead.instagram),
    linha('Site atual', lead.website),
    linha('Situação do site atual', lead.siteDetalhe || lead.websiteLabel),
    linha('Ficha no Google Maps', lead.mapsUrl),
    lead.rating
      ? `- **Reputação no Google:** ${lead.rating.toFixed(1).replace('.', ',')} estrelas em ${lead.reviews ?? 0} avaliações`
      : null,
    lead.lat && lead.lng ? `- **Coordenadas:** ${lead.lat}, ${lead.lng}` : null,
    linha('Anotações da prospecção', lead.notes),
  ]
    .filter(Boolean)
    .join('\n');

  const semFotos = [
    'Não tenho as fotos nem os textos oficiais do cliente — este site é uma prévia',
    'feita de fora para mostrar a ele como ficaria. Use imagens de banco gratuitas',
    '(Unsplash) coerentes com o ramo, e escreva os textos você mesmo a partir dos',
    'dados acima. Deixe tudo fácil de trocar depois, num único arquivo de conteúdo.',
  ].join(' ');

  return `Preciso que você construa um site de prévia para um comércio real. Este site vai ser mostrado ao dono como demonstração, então ele precisa ficar bom de verdade — é a peça que vai fechar a venda.

## ANTES DE COMEÇAR: INSTALE AS SKILLS

Rode este comando exatamente como está, sem alterar nada:

\`\`\`bash
${COMANDO_SKILLS}
\`\`\`

Depois de instalar, use essas skills durante todo o trabalho — principalmente as de design e frontend. O site não pode ter cara de template genérico.

## O CLIENTE

${dados}

## O QUE ESTE SITE PRECISA TER

${focoDoRamo(lead.category)}

E em qualquer caso:
- Botão de WhatsApp fixo, sempre alcançável, com mensagem já escrita${zap ? ` (use ${zap})` : ''}.
- Responsivo de verdade: a maioria vai abrir no celular. Alvos de toque de no mínimo 44px.
- Rápido. Nada de biblioteca pesada para fazer o que CSS resolve.
- SEO básico: title, description, Open Graph e dados estruturados de negócio local, com endereço e horário.
- Acessível: contraste adequado, textos alternativos nas imagens, navegação por teclado.

## CONTEÚDO

${semFotos}

## STACK E PUBLICAÇÃO

- **Next.js** com TypeScript e Tailwind.
- Código versionado no **GitHub**, em repositório novo para este cliente.
- Publicado na **Vercel**, conectado a esse repositório.
- No fim, me devolva o endereço público da Vercel — é o link que eu vou mandar para o dono.

## COMO EU QUERO QUE VOCÊ TRABALHE

1. Antes de escrever código, me diga em três linhas a direção visual que escolheu e por quê, considerando o ramo e o público desse comércio.
2. Construa o site.
3. Suba para o GitHub e publique na Vercel.
4. Me entregue: o link do site no ar, o link do repositório, e o que eu preciso pedir ao cliente para deixar o site definitivo (fotos, textos, logo, o que for).

Não invente informação sobre o negócio. Se precisar de um dado que não está acima — preço, horário, tempo de mercado — use um marcador visível de que ali entra a informação real, ou pergunte. Prévia com dado inventado queima a conversa.

Quem está vendendo este site é a ${nomeEmpresa}.`;
}
