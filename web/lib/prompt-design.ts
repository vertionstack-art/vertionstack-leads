/**
 * Fase 1: o prompt que desenha a prévia no Claude Design.
 *
 * Esta prévia existe para vender, não para entregar. Ninguém pagou nada
 * ainda, o dono não mandou foto nem texto, e a página vai ser aberta no
 * celular dele por uns quinze segundos entre um cliente e outro. O que
 * decide a venda é o impacto dos primeiros segundos, não a arquitetura.
 *
 * Por isso este prompt é o oposto do da fase 2: aqui não há repositório,
 * não há Vercel, não há SEO, não há formulário que precise funcionar.
 * Pedir essas coisas agora só atrasa a peça que abre a conversa — e boa
 * parte delas ainda vai mudar quando o cliente entregar o material dele.
 *
 * O prompt do Claude Code, que pega esta prévia aprovada e transforma em
 * site publicado, está em prompt-site.ts.
 */

import type { Lead } from './db';
import { focoDoRamo } from './foco-ramo';

/** só os dígitos, no formato que o link do WhatsApp aceita */
function whatsappDe(telefone: string | null): string | null {
  if (!telefone) return null;
  const d = telefone.replace(/\D/g, '');
  if (d.length < 10) return null;
  return 'https://wa.me/' + (d.startsWith('55') ? d : '55' + d);
}

export function montarPromptDesign(lead: Lead, nomeEmpresa = 'Vertion Stack'): string {
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
    lead.hours ? `- **Horário:** ${lead.hours}` : null,
    lead.rating
      ? `- **Reputação no Google:** ${lead.rating.toFixed(1).replace('.', ',')} estrelas em ${lead.reviews ?? 0} avaliações`
      : null,
    linha('Anotações da prospecção', lead.notes),
  ]
    .filter(Boolean)
    .join('\n');

  return `Preciso que você desenhe uma página de demonstração para um comércio real. Ela vai ser mostrada ao dono para fechar a venda de um site — então ela precisa causar impressão na primeira olhada, no celular, em quinze segundos.

## O QUE ESTA PÁGINA É, E O QUE ELA NÃO É

É uma **prévia de venda**. O dono ainda não comprou nada, não me mandou nenhuma foto, nenhum texto, nenhum preço. Fui eu que montei, de fora, a partir do que achei sobre o negócio dele.

Então:
- **Uma página só.** Nada de várias telas, navegação entre páginas ou área logada.
- **Nada precisa funcionar de verdade.** Formulário, agendamento e carrinho são para a próxima etapa. Aqui eles só precisam existir visualmente, no lugar certo.
- **Não se preocupe com SEO, performance ou acessibilidade avançada** — isso entra quando o site for publicado para valer. Contraste legível e texto em tamanho confortável, sim; auditoria completa, não.
- **Capriche no visual acima de tudo.** É o único critério que decide se essa venda acontece.

## O NEGÓCIO

${dados}

## O QUE PRECISA APARECER

${focoDoRamo(lead.category)}

E sempre:
- **O nome do comércio grande e logo de cara.** O dono precisa se reconhecer no primeiro segundo. Esse é o efeito que vende.
- Botão de WhatsApp bem visível${zap ? ` (use ${zap})` : ''}.
- Endereço, horário e telefone fáceis de achar.
- **Desenhe primeiro para o celular.** É lá que ele vai abrir. Se ficar bom no celular e razoável no computador, está certo; o contrário não serve.

## DIREÇÃO VISUAL

Escolha uma direção que combine com o ramo e com o público **deste** comércio, e não a que está na moda. Barbearia de bairro, clínica e pizzaria não se parecem, e página de pequeno negócio com cara de startup de tecnologia não convence ninguém.

Antes de desenhar, me diga em três linhas: a direção que escolheu, a paleta e a tipografia — e por quê, considerando o ramo e a cidade.

Trabalhe com o mesmo cuidado das disciplinas de design de interface, design mobile e sistema de design: hierarquia clara, espaçamento consistente, tipografia com escala, e textos que soem escritos por gente. Nada de página montada com peças soltas.

## CONTEÚDO

Não tenho as fotos nem os textos oficiais. Use imagens de banco gratuitas coerentes com o ramo e escreva os textos você mesmo, a partir dos dados acima.

**Não invente informação sobre o negócio.** Nada de preço, horário, tempo de mercado, número de clientes ou depoimento que eu não tenha passado. Se precisar de um dado que não está aqui, use um texto neutro que funcione sem ele — nunca um número inventado. O dono vai ler isso e vai saber na hora o que é falso, e aí a conversa acabou.

${lead.rating ? 'A reputação no Google acima é real e é dele: pode mostrar as estrelas na página. É a única prova social verdadeira que temos.\n\n' : ''}## O QUE ME ENTREGAR

1. As três linhas sobre a direção visual.
2. A página.
3. Uma frase dizendo qual é o elemento que você acha que mais vai impressionar o dono — é por ele que eu vou começar a conversa.

Quem está vendendo este site é a ${nomeEmpresa}. Depois que o dono aprovar, esta página vira o site definitivo, com o material real dele.`;
}
