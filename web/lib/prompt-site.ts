/**
 * Fase 2: o prompt que transforma a prévia aprovada em site publicado.
 *
 * Roda no Claude Code, depois da venda fechada. A fase 1 (prompt-design.ts)
 * desenhou a página no Claude Design para abrir a conversa; aqui ela vira
 * repositório, domínio e site no ar, já com o material real do cliente.
 *
 * A regra que rege este prompt inteiro: **o cliente comprou o que viu.**
 * Assistente que recebe um design pronto tende a "melhorar" — troca a cor,
 * reorganiza a seção, escolhe outra fonte. Isso não é melhoria, é entregar
 * coisa diferente da que foi vendida, e quem descobre é o dono na hora de
 * receber.
 *
 * O prompt começa mandando parar e esperar o link do repositório. Quem cria
 * é o Lucas, na conta certa: assistente que cria repositório sozinho acaba
 * abrindo na conta errada, com o nome errado, e aí o trabalho já nasce no
 * lugar errado.
 */

import type { Lead } from './db';
import { focoDoRamo } from './foco-ramo';
import { porId } from './catalogo';
import { normalizarMarcacoes } from './proposta';

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
 * O que o cliente efetivamente comprou, lido da proposta salva no lead.
 *
 * Faz diferença de verdade: sem esta lista o assistente entrega a mesma
 * página estática da prévia, e o agendamento que foi vendido — e cobrado —
 * continua sendo um botão que não faz nada.
 */
function contratado(lead: Lead): string | null {
  const p = lead.proposta as { marcacoes?: unknown } | null;
  if (!p || typeof p !== 'object') return null;

  const marcacoes = normalizarMarcacoes(p.marcacoes as never);
  const itens = Object.keys(marcacoes)
    .filter((id) => marcacoes[id])
    .map((id) => porId(id))
    .filter(Boolean)
    .map((s) => `- **${s!.nome}** — ${s!.beneficio}`);

  return itens.length ? itens.join('\n') : null;
}

export function montarPromptSite(lead: Lead, nomeEmpresa = 'Vertion Stack'): string {
  const zap = whatsappDe(lead.phone);
  const linha = (rotulo: string, valor: string | null | undefined) => (valor ? `- **${rotulo}:** ${valor}` : null);
  const comprou = contratado(lead);

  const dados = [
    linha('Nome do comércio', lead.name),
    linha('Ramo', lead.category),
    linha('Endereço', lead.address),
    linha('Cidade / região', lead.city),
    linha('Telefone', lead.phone),
    linha('Link direto do WhatsApp', zap),
    linha('Instagram', lead.instagram),
    linha('Site antigo', lead.website),
    linha('Situação do site antigo', lead.siteDetalhe || lead.websiteLabel),
    linha('Horário', lead.hours),
    linha('Ficha no Google Maps', lead.mapsUrl),
    lead.rating
      ? `- **Reputação no Google:** ${lead.rating.toFixed(1).replace('.', ',')} estrelas em ${lead.reviews ?? 0} avaliações`
      : null,
    lead.lat && lead.lng ? `- **Coordenadas:** ${lead.lat}, ${lead.lng}` : null,
    linha('Anotações da prospecção', lead.notes),
  ]
    .filter(Boolean)
    .join('\n');

  return `Este comércio **já fechou negócio**. Existe uma prévia aprovada por ele, e o seu trabalho é transformá-la em site publicado de verdade.

## PARE AQUI: PRIMEIRO EU CRIO O REPOSITÓRIO E TE MANDO O DESIGN

**Não comece nada ainda.** Eu vou te mandar duas coisas:

1. O link do repositório no GitHub, que eu crio na conta certa.
2. O design aprovado — o código ou o link da prévia que o cliente já viu e aceitou.

Sua primeira resposta deve ser só isso: peça as duas coisas e aguarde. Não instale nada, não escreva código, não crie repositório nenhum por conta própria.

${
  lead.previaUrl
    ? `A prévia aprovada está no ar aqui, para você conferir enquanto espera:\n\n${lead.previaUrl}\n`
    : 'Se eu esquecer de mandar o design, peça antes de qualquer coisa. Não comece do zero.\n'
}
## O CLIENTE COMPROU O QUE VIU

Esta é a regra mais importante deste trabalho.

O dono aprovou um layout, uma paleta, uma tipografia e uma ordem de seções. **Isso está vendido.** Não troque a cor porque outra combina mais, não reorganize a página porque faz mais sentido, não escolha outra fonte porque é mais moderna. Se você "melhorar" o design, está entregando uma coisa diferente da que foi comprada — e quem vai perceber é o dono, na entrega.

O que você faz aqui é o que a prévia não tinha:

- fazer funcionar de verdade o que lá era só aparência
- trocar as imagens de banco pelas fotos reais dele
- trocar os textos de exemplo pelos dados reais
- deixar o site rápido, encontrável e acessível
- publicar

Se achar que alguma coisa do design está errada de fato — algo que quebra em tela pequena, contraste ilegível, um elemento que atrapalha a conversão — **me pergunte antes de mudar**. Não decida sozinho.

## ASSIM QUE EU MANDAR OS DOIS: INSTALE AS SKILLS

Rode este comando exatamente como está, sem alterar nada:

\`\`\`bash
${COMANDO_SKILLS}
\`\`\`

**O uso dessas skills é obrigatório, não opcional.** Não escreva uma linha de código antes de carregá-las e ler o que elas orientam.

Em especial:
- **senior-frontend** e **ui-design-system** guiam a estrutura dos componentes e a consistência.
- **mobile-design** manda no comportamento em tela pequena, que é onde a maioria vai abrir.
- **frontend-design** e **ui-ux-pro-max** servem aqui para **preservar** a direção visual aprovada com rigor, não para propor outra.
- **senior-backend** e **senior-architect** entram no que foi contratado e precisa funcionar.
- **humanizer** passa nos textos no fim, para não soarem escritos por máquina.

Antes de me entregar o site, diga quais skills você consultou e o que cada uma mudou na sua decisão.

## O CLIENTE

${dados}

${
  comprou
    ? `## O QUE FOI VENDIDO — E PRECISA FUNCIONAR DE VERDADE

Isto é o escopo pago. Na prévia era enfeite; aqui tem que funcionar:

${comprou}

Se algum destes itens depender de conta, chave ou serviço externo, me diga exatamente o que você precisa que eu providencie, antes de começar.`
    : `## ESCOPO

Não anexei a lista do que foi contratado. Antes de começar, me pergunte o que exatamente foi vendido — principalmente se tem agendamento, formulário, catálogo ou automação, porque isso muda o que precisa funcionar de verdade.`
}

## O MATERIAL REAL DO CLIENTE

A prévia foi feita com foto de banco e texto que eu escrevi. Agora é para valer.

**Antes de construir, me peça em uma lista objetiva** o que falta: logo em boa resolução, fotos reais do espaço e do trabalho, textos ou informações que só o dono tem, preços, e as contas necessárias (domínio, e-mail, redes).

Enquanto o material não chegar, use o que a prévia já tinha e **marque de forma visível** cada ponto que depende de material real. Nada de dado inventado entrando como se fosse definitivo.

## O QUE O SITE PRECISA TER

${focoDoRamo(lead.category)}

E em qualquer caso:
- Botão de WhatsApp fixo, sempre alcançável, com mensagem já escrita${zap ? ` (use ${zap})` : ''}.
- Responsivo de verdade: a maioria vai abrir no celular. Alvos de toque de no mínimo 44px.
- Rápido. Nada de biblioteca pesada para fazer o que CSS resolve.
- SEO: title, description, Open Graph e dados estruturados de negócio local, com endereço e horário.
- Acessível: contraste adequado, textos alternativos nas imagens, navegação por teclado.

## STACK E PUBLICAÇÃO

- **Next.js** com TypeScript e Tailwind.
- Código versionado **no repositório que eu te mandei** — não crie outro.
- Publicado na **Vercel**, conectado a esse repositório.
- Todo o conteúdo editável reunido num único arquivo, para o dono conseguir mudar texto e preço depois sem mexer em código.
- No fim, me devolva o endereço público da Vercel.

## COMO EU QUERO QUE VOCÊ TRABALHE

1. Peça o repositório e o design aprovado. Espere.
2. Instale as skills com o comando acima. Isso é obrigatório.
3. Me diga o que entendeu do design aprovado — direção visual, paleta, seções — para eu confirmar que você vai reproduzir e não recriar.
4. Me passe a lista do material que falta.
5. Construa.
6. Suba para o repositório que eu mandei e publique na Vercel.
7. Me entregue: o link no ar, o que ainda depende de material do cliente, e como o dono faz para trocar texto e preço sozinho.

Quem está entregando este site é a ${nomeEmpresa}.`;
}
