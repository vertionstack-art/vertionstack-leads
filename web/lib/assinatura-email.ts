/**
 * A assinatura dos e-mails da Vertion (foto, nome, cargo, contatos e logo).
 *
 * Feita do jeito que e-mail aceita: tabela, estilo escrito em cada tag e
 * fonte que todo computador tem (Arial). Gmail, Outlook e celular ignoram
 * folha de estilo e fonte da web, e só mostram imagem que está num endereço
 * público, por isso a foto e a logo moram em leads.vertionstack.com.
 *
 * A mesma assinatura vai no fim dos e-mails que a ferramenta mandar e é a
 * que o Lucas cola nas configurações do Gmail (assinatura-email-vertion.html).
 */

const BASE = 'https://leads.vertionstack.com/assinatura';

export const ASSINATURA = {
  nome: 'Lucas Teles',
  cargo: 'CEO',
  empresa: 'Vertion Stack',
  whatsapp: '+55 21 98468-4009',
  whatsappLink: 'https://wa.me/5521984684009',
  email: 'vertionstack@gmail.com',
  site: 'vertionstack.com',
  siteLink: 'https://vertionstack.com',
  foto: `${BASE}/lucas-teles.png`,
  logo: `${BASE}/vertion-logo.png`,
};

const ROXO = '#7A16E0';
const TINTA = '#12101B';
const APOIO = '#565068';

const linha = (rotulo: string, valor: string, href: string) =>
  `<tr><td style="padding:2px 10px 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.6px;text-transform:uppercase;color:${APOIO};white-space:nowrap;">${rotulo}</td>` +
  `<td style="padding:2px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;"><a href="${href}" style="color:${TINTA};text-decoration:none;">${valor}</a></td></tr>`;

/** a assinatura em HTML, para colar no fim do corpo do e-mail */
export function assinaturaHtml(): string {
  const a = ASSINATURA;
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin-top:8px;">
<tr>
<td style="padding:0 18px 0 0;vertical-align:middle;">
<img src="${a.foto}" width="88" height="88" alt="${a.nome}" style="display:block;width:88px;height:88px;border-radius:44px;border:0;">
</td>
<td style="padding:2px 0 2px 18px;vertical-align:middle;border-left:3px solid ${ROXO};">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:${TINTA};line-height:1.2;">${a.nome}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${ROXO};padding-top:3px;">${a.cargo} &middot; ${a.empresa}</div>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin-top:9px;">
${linha('WhatsApp', a.whatsapp, a.whatsappLink)}
${linha('E-mail', a.email, `mailto:${a.email}`)}
${linha('Site', a.site, a.siteLink)}
</table>
</td>
<td style="padding:0 0 0 18px;vertical-align:middle;">
<a href="${a.siteLink}" style="text-decoration:none;"><img src="${a.logo}" width="34" height="32" alt="Vertion Stack" style="display:block;width:34px;height:32px;border:0;"></a>
</td>
</tr>
</table>`;
}

/** a mesma assinatura em texto puro, para a versão sem HTML do e-mail */
export function assinaturaTexto(): string {
  const a = ASSINATURA;
  return `--\n${a.nome}\n${a.cargo} · ${a.empresa}\nWhatsApp: ${a.whatsapp}\nE-mail: ${a.email}\n${a.siteLink}`;
}
