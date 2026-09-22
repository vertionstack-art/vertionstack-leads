/**
 * Monta o prompt que gera o e-mail frio de um lead de fora do Brasil.
 *
 * O prompt sai em inglês de propósito. A IA responde no idioma em que é
 * falada, e o que precisa chegar bem escrito é o e-mail, não o pedido —
 * prompt em português tende a devolver inglês traduzido, que um nativo
 * reconhece na primeira linha e apaga.
 *
 * A diferença para o prompt de abordagem brasileiro não é só idioma. Lá o
 * canal é WhatsApp, onde dá para ser direto e o dono responde do balcão.
 * Aqui é e-mail frio: uma tentativa, sem contexto prévio, competindo com
 * mais quarenta na caixa de entrada. Por isso o prompt gasta mais linhas
 * no assunto e na primeira frase do que no resto do corpo — é onde a
 * mensagem morre.
 */

import type { Lead } from './db';
import { origemDoLead } from './pais';

interface Diagnostico {
  situacao: string;
  custo: string;
  cuidado: string;
}

/**
 * O que está errado na presença digital, e quanto isso custa ao dono.
 *
 * O e-mail inteiro se apoia nisto. Sem um problema concreto e específico,
 * a mensagem vira folheto e não tem por que ser lida.
 */
function diagnostico(lead: Lead): Diagnostico {
  const site = lead.website || 'the listed website';

  switch (lead.siteStatus) {
    case 'fora_do_ar':
      return {
        situacao: `Google lists a website (${site}), but it does not load. ${lead.siteDetalhe || ''}`.trim(),
        custo:
          'Every person who finds them on Google and clicks through lands on an error page and goes to a competitor. ' +
          'The owner almost certainly does not know. They may still be paying for hosting on a site that no longer exists.',
        cuidado:
          'Lead with the warning, not the pitch. Someone probably abandoned them. Being the person who told them ' +
          'is worth more than being the person selling to them.',
      };

    case 'certificado_vencido':
      return {
        situacao: `Their site (${site}) has an expired security certificate.`,
        custo:
          'Browsers show a full red "attackers may be trying to steal your information" warning before letting anyone in. ' +
          'Most people never click past it. The site exists but is effectively invisible.',
        cuidado:
          'Ask them to open their own site on their phone. Seeing the red screen beats any explanation you can write.',
      };

    case 'em_construcao':
      return {
        situacao: `The listed address (${site}) loads but has no real content. ${lead.siteDetalhe || ''}`.trim(),
        custo:
          'A blank or "coming soon" page reads as a business that closed down. That is worse than having no site at all.',
        cuidado: 'Something went wrong with a project they started. Find out what before proposing anything.',
      };

    case 'virou_social':
      return {
        situacao: `What Google lists as their website (${site}) actually redirects to a social profile.`,
        custo:
          'They do not own that address. It disappears if the platform suspends the account, it ranks poorly on Google, ' +
          'and they cannot put a booking form, a menu or a quote request on it.',
        cuidado:
          'Never criticise the social account — it is working for them. Position the site as the missing piece, not the replacement.',
      };

    case 'sem_https':
      return {
        situacao: `Their site (${site}) works, but has no HTTPS.`,
        custo:
          'Chrome flags it as "Not secure" in the address bar, and Google ranks it below competitors that are secure.',
        cuidado: 'Small, cheap problem. Use it as the door into a bigger conversation, not as the whole pitch.',
      };
  }

  switch (lead.websiteKind) {
    case 'none':
      return {
        situacao: 'No website at all. Only a Google Maps listing.',
        custo:
          'When someone in the area searches for this service, competitors with websites come up and they do not. ' +
          'They live on walk-ins and word of mouth, which does not scale and does not survive a slow month.',
        cuidado:
          'Do not assume they want a website because websites are modern. Ask how customers find them today ' +
          'and where that breaks.',
      };

    case 'social':
      return {
        situacao: `Their only listed web presence is a social profile (${site}).`,
        custo:
          'Rented audience. It depends on an algorithm and vanishes if the account goes down. It barely shows up ' +
          'on Google, and it cannot take a booking, show a price list or capture a lead.',
        cuidado:
          'If the social account is doing well, they will say they do not need a site. Do not argue — ' +
          'frame the site as the place the social account sends people to.',
      };

    case 'marketplace':
      return {
        situacao: `Their web presence is a third-party platform (${site}).`,
        custo:
          'They pay a commission on every customer and do not own the relationship. The platform holds the data. ' +
          'If the fees or the rules change, they have nowhere to go.',
        cuidado:
          'The platform brings real customers — never tell them to drop it. The angle is a channel of their own ' +
          'alongside it, where the whole margin is theirs.',
      };

    case 'weak':
      return {
        situacao: `They have a free site builder page or an auto-generated listing (${site}).`,
        custo:
          'Usually slow, with an odd address, no identity, and sometimes carrying ads for the builder itself. ' +
          'It makes an established business look improvised.',
        cuidado: 'Someone in the family probably built it. Criticise the result, never the person.',
      };
  }

  return {
    situacao: 'They appear to have a working website of their own.',
    custo:
      'The angle here is not the absence of a site. It is what the current one fails to do: capture contacts, ' +
      'load fast on a phone, rank on Google, turn a visit into a booking.',
    cuidado:
      'The hardest lead on the list. Only write if you have a concrete, specific observation. Never argue about taste.',
  };
}

/** a reputação vira prova social — e prova social é o ativo que ele já tem */
function reputacao(lead: Lead): string {
  if (!lead.rating) return 'No Google reviews yet.';
  const n = lead.reviews || 0;
  const nota = lead.rating.toFixed(1);

  if (n >= 100 && lead.rating >= 4.5)
    return (
      `${nota} stars across ${n} reviews. This is strong social proof they have already earned and ` +
      'currently have nowhere to display. Use it — it is their asset, not your claim.'
    );
  if (lead.rating < 4)
    return `${nota} stars across ${n} reviews. Below average. Do not mention the rating; it will read as an insult.`;
  return `${nota} stars across ${n} reviews.`;
}

export function montarPromptGringa(lead: Lead, nomeEmpresa = 'Vertion Stack'): string {
  const d = diagnostico(lead);
  const origem = origemDoLead(lead);
  const idioma = origem.idiomaEmIngles;

  const dados = [
    `- Business name: ${lead.name}`,
    lead.category ? `- Type of business: ${lead.category}` : null,
    lead.address ? `- Address: ${lead.address}` : null,
    lead.city ? `- City: ${lead.city}` : null,
    origem.pais ? `- Country: ${origem.pais}` : null,
    lead.phone ? `- Phone: ${lead.phone}` : null,
    lead.instagram ? `- Instagram: ${lead.instagram}` : null,
    lead.website ? `- Listed website: ${lead.website}` : null,
    lead.hours ? `- Opening hours: ${lead.hours}` : null,
    lead.mapsUrl ? `- Google Maps listing: ${lead.mapsUrl}` : null,
    `- Reputation: ${reputacao(lead)}`,
    lead.notes ? `- Notes from prospecting: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const previa = lead.previaUrl
    ? `## THE STRONGEST CARD IN THIS EMAIL: THE SITE ALREADY EXISTS

I have already built them a working preview site. It is live right now:

${lead.previaUrl}

This changes everything about the email. I am not asking them to imagine anything and I am not asking
them to buy anything yet — I am showing them something that already exists, with their own name on it,
that I built before they ever replied to me.

Use this properly:
- Lead with it. The preview is the reason the email is worth opening, so it belongs near the top.
- Name it as something already done, not something offered. "I built you one" beats "I could build you one".
- This is reciprocity, and it is the strongest lever in the whole message: I gave first, unasked.
- It also removes the risk from replying. They are not agreeing to a meeting, they are clicking a link.
- Make the call to action about the preview itself, not about a sales call.`
    : `## NO PREVIEW SITE YET

I have not built them a preview. Do not invent one and do not imply a site exists. The call to action
has to earn a reply on its own — make it small enough that answering costs them nothing.`;

  return `You are an elite B2B cold email copywriter. Your emails get replies from small business owners
who delete almost everything else in their inbox.

I sell websites, landing pages and automation to local businesses. I found this business on Google Maps,
verified its web presence myself, and I am writing one cold email to the owner.

Write that email.

## USE PERSUASION. THIS IS THE POINT OF THE TASK.

Use real persuasion techniques deliberately, and make the email genuinely desirable to read. Specifically:

- **Loss aversion over gain framing.** People move faster to stop losing something than to gain something.
  "You are losing the people who search for you" lands harder than "you could get more customers".
- **Problem — Agitate — Solution.** Name what is broken, make them feel the cost of it in terms they
  already recognise, then show the way out.
- **Reciprocity.** Give something real before asking for anything.
- **Social proof they already own.** Their own reviews and reputation, reflected back at them.
- **Specificity as proof.** Real details prove a human actually looked. Never write "your online presence" —
  write the exact thing you saw.
- **Future pacing.** Let them picture the customer who finds them next week and books.
- **Curiosity gap in the subject line.** Enough to open, never clickbait.
- **Low friction close.** One single ask, and make it almost free to say yes to.

Make it emotionally compelling. Make them want it. A polite, competent, forgettable email is a failure —
it has to touch something they already worry about at 11pm.

## WHAT I FOUND

${d.situacao}

**Why this costs them money:** ${d.custo}

**Careful:** ${d.cuidado}

## THE BUSINESS

${dados}

${previa}

## HOW THE EMAIL MUST BE BUILT

**Language:** write in ${idioma}. Native register, the way a person there actually writes — not translated,
with no phrasing that gives away a non-native writer.

**Subject line:** under 6 words. Sentence case, like a real person wrote it, not a campaign. No emoji.
No fake "Re:" and no fake threading — that is a trick, and it destroys trust the moment it is noticed.

**First line:** about them, never about me. Never open with my name, my company, or "I hope this email
finds you well". The first sentence has to prove a human looked at their business specifically.

**Length:** 90 to 140 words in the body. It has to be readable on one phone screen without scrolling.

**Tone:** one business owner talking to another. Plain words, short sentences. No corporate vocabulary —
no "leverage", no "solutions", no "digital transformation", no "in today's competitive landscape".
No stacked adjectives. No exclamation marks.

**Formatting:** plain text. No images and no HTML layout — those land in spam and look like a campaign.
One short paragraph per idea, blank line between.

**Close:** exactly one call to action, and make it cost them nothing. A yes-or-no question they can answer
with a single word beats asking for a 15-minute call.

**P.S.:** include one. After the subject line it is the most-read part of a cold email. Put the concrete,
valuable thing there.

## RULES YOU DO NOT BREAK

1. **Invent nothing.** No fake case studies, no made-up client names, no statistics I did not give you,
   no "we helped 50 businesses like yours". If you want a number, take it from the data above or leave it
   out. One invented claim that gets checked ends the deal and the reputation.
2. **No false urgency.** No fake deadlines, no "only taking 3 clients this month". Owners have seen it.
3. **Comply with cold email law.** Not optional — it is what keeps my domain off spam blacklists and out
   of legal trouble. The email must:
   - identify who is writing and make clear it is business outreach,
   - carry a real, plain opt-out line ("if this is not useful, say so and I will not write again"),
   - use an accurate subject line and a truthful sender name,
   - leave room for my real business address in the signature.
   That covers CAN-SPAM in the United States and the legitimate-interest B2B route under GDPR and PECR
   in Europe.
4. **Never disparage the person.** Criticise the situation, never the owner and never whoever built the
   old site.
5. **No attachments.**

## WHAT TO GIVE ME BACK

1. **Three subject lines**, each with a one-line note on the angle it plays, and which one you would send.
2. **The email**, ready to paste and send, with a signature block marking where my name, business name,
   phone and address go.
3. **Follow-up 1** — sent 3 days later if there is no reply. A new angle, never "just bumping this".
   Under 60 words.
4. **Follow-up 2** — sent 7 days after that. The polite close-out that gives them an easy exit. Under
   40 words. These close more deals than the first email does.
5. **A two-line version** for LinkedIn or Instagram DM, in case the email bounces.
6. **One line** telling me what the single strongest lever in this email is, so I know what I am testing
   when I send it.

The business selling this is ${nomeEmpresa}.`;
}
