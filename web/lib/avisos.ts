/**
 * Os e-mails automáticos e quando cada um sai.
 *
 * Na hora (o próprio evento dispara):
 * - boas-vindas: a conta acabou de ser criada;
 * - teste acabando: usou 80% dos leads do teste grátis;
 * - teste acabou: usou todos.
 *
 * Uma vez por dia (app/api/cron/avisos, agendado no vercel.json):
 * - plano vencendo: Pix ou 7 dias (não renovam sozinhos) vencem em até 48h;
 * - plano vencido: venceu nos últimos 3 dias e não tem cartão renovando;
 * - compra pela metade: abriu o pagamento da Stripe e não concluiu.
 *
 * Recibo de pagamento e cartão recusado ficam com a própria Stripe (ligar
 * em Configurações → E-mails para clientes), que já manda os dois.
 *
 * Cada aviso sai uma vez por motivo (tabela emails_enviados). Se o envio
 * falhar, a marca é desfeita e o próximo disparo tenta de novo.
 */

import { db } from './sql';
import { enviarEmail, emailLigado, linkSair, SITE, type Mensagem } from './email';
import { LIMITES, NOME_DO_PLANO, PLANOS_A_VENDA, reais, type Plano } from './planos';
import { PISO_ABSOLUTO } from './proposta';

const primeiroNome = (s: string | null | undefined) => {
  const p = (s || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
};

const preco = (p: Plano) => reais(PLANOS_A_VENDA.find((x) => x.plano === p)?.precoCentavos ?? 0);

const dia = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' });

/** marca, envia e desfaz a marca se o envio falhar; devolve se saiu */
async function enviarUmaVez(conta: string, tipo: string, chave: string, para: string, assunto: string, m: Mensagem): Promise<boolean> {
  if (!emailLigado()) return false;
  const sql = db();
  const marcado = await sql`
    insert into emails_enviados (conta_id, tipo, chave) values (${conta}, ${tipo}, ${chave})
    on conflict do nothing returning id
  `;
  if (!marcado.length) return false;
  const ok = await enviarEmail(para, assunto, m);
  if (!ok) await sql`delete from emails_enviados where id = ${marcado[0].id}`;
  return ok;
}

async function donos(contas: string[]): Promise<Map<string, { email: string; nome: string }>> {
  if (!contas.length) return new Map();
  const r = await db()`select conta_id, email, nome from public.emails_dos_donos(${contas}::uuid[])`;
  return new Map(r.map((x) => [x.conta_id as string, { email: x.email as string, nome: x.nome as string }]));
}

// ------------------------------------------------------------ na hora

export async function avisarBoasVindas(conta: string, email: string, nome: string): Promise<void> {
  try {
    const n = primeiroNome(nome);
    await enviarUmaVez(conta, 'boas_vindas', '', email, 'Sua conta no Vertion Leads está pronta', {
      previa: `${LIMITES.gratis.semana} leads grátis para achar o seu primeiro cliente.`,
      titulo: n ? `Tudo pronto, ${n}.` : 'Tudo pronto.',
      paragrafos: [
        `Sua conta tem **${LIMITES.gratis.semana} leads grátis** para testar, sem cartão.`,
        'O caminho mais curto até o primeiro cliente:',
        '**1.** Busque o ramo e a cidade. A lista chega só com quem precisa de site, já quente, morno ou frio.',
        '**2.** Abra um lead quente e clique em WhatsApp: a mensagem já vem escrita com o motivo daquele comércio.',
        '**3.** Monte a proposta. O link avisa quando o cliente abrir.',
      ],
      botao: { texto: 'Fazer minha primeira busca', url: `${SITE}/buscar` },
    });
  } catch (e) {
    console.error('[aviso boas-vindas]', e);
  }
}

/** chamado depois de o teste grátis conceder leads (lib/conta) */
export async function avisarTeste(conta: string, usados: number, total: number): Promise<void> {
  try {
    if (usados < Math.ceil(total * 0.8)) return;
    const d = (await donos([conta])).get(conta);
    if (!d) return;
    const n = primeiroNome(d.nome);
    const umSite = Math.floor((PISO_ABSOLUTO * 100) / (PLANOS_A_VENDA.find((p) => p.plano === 'basic')?.precoCentavos || 1));
    if (usados >= total) {
      await enviarUmaVez(conta, 'teste_acabou', '', d.email, 'Seu teste grátis acabou', {
        previa: 'Seus leads, o CRM e as propostas continuam salvos.',
        titulo: n ? `${n}, seu teste grátis acabou.` : 'Seu teste grátis acabou.',
        paragrafos: [
          `Você usou os ${total} leads do teste. Sua lista, o CRM e as propostas continuam aí; só a busca de comércios novos parou.`,
          `Para continuar, o plano de **7 dias custa ${preco('semanal')}**, sem assinatura. O **Basic sai ${preco('basic')} por mês**.`,
          `Um único site no preço mínimo que a proposta sugere (${reais(Math.round(PISO_ABSOLUTO * 100))}) paga ${umSite} meses de Basic.`,
        ],
        botao: { texto: 'Escolher meu plano', url: `${SITE}/planos` },
      });
    } else {
      const restam = total - usados;
      await enviarUmaVez(conta, 'teste_acabando', '', d.email, `Restam ${restam} leads do seu teste grátis`, {
        previa: 'Use os últimos leads nos comércios quentes primeiro.',
        titulo: `Restam ${restam} leads do seu teste.`,
        paragrafos: [
          `Você já usou ${usados} dos ${total} leads grátis.`,
          'Dica para aproveitar o que falta: chame primeiro os quentes, principalmente os de **site fora do ar**. O dono já pagou por um site e está perdendo cliente hoje.',
          `Quando o teste acabar, o plano de 7 dias custa ${preco('semanal')}, sem assinatura.`,
        ],
        botao: { texto: 'Ver meus leads quentes', url: SITE },
      });
    }
  } catch (e) {
    console.error('[aviso teste]', e);
  }
}

// --------------------------------------------------------- uma vez por dia

export interface ResultadoAvisos {
  vencendo: number;
  vencido: number;
  metade: number;
}

export async function rodarAvisosDoDia(): Promise<ResultadoAvisos> {
  const res: ResultadoAvisos = { vencendo: 0, vencido: 0, metade: 0 };
  if (!emailLigado()) return res;
  const sql = db();

  // Pix ou 7 dias vencendo: não renovam sozinhos
  const vencendo = await sql`
    select id, plano, pago_ate from contas
    where plano in ('semanal', 'basic', 'pro') and stripe_assinatura_id is null and not bloqueada
      and pago_ate > now() and pago_ate <= now() + interval '48 hours'
  `;
  // venceu nos últimos 3 dias e não há cartão renovando
  const vencidos = await sql`
    select id, plano, pago_ate from contas
    where plano in ('semanal', 'basic', 'pro', 'pago') and stripe_assinatura_id is null and not bloqueada
      and pago_ate <= now() and pago_ate > now() - interval '3 days'
  `;
  // abriu o pagamento, não concluiu, e não pagou por outro caminho depois
  const metade = await sql`
    select distinct on (k.conta_id) k.id, k.conta_id, k.plano from checkouts k
    join contas c on c.id = k.conta_id
    where k.pago_em is null and k.criado_em < now() - interval '2 hours' and k.criado_em > now() - interval '3 days'
      and c.emails_aviso and not c.bloqueada and c.plano <> 'cortesia'
      and not exists (select 1 from checkouts p where p.conta_id = k.conta_id and p.pago_em is not null and p.criado_em >= k.criado_em)
      and not exists (select 1 from emails_enviados e where e.conta_id = k.conta_id and e.tipo = 'compra_pela_metade' and e.enviado_em > now() - interval '7 days')
    order by k.conta_id, k.criado_em desc
  `;

  const quem = await donos([...new Set([...vencendo, ...vencidos, ...metade].map((r) => (r.conta_id || r.id) as string))]);

  for (const c of vencendo) {
    const d = quem.get(c.id);
    if (!d) continue;
    const nome = NOME_DO_PLANO[c.plano as Plano];
    const ate = new Date(c.pago_ate);
    const ok = await enviarUmaVez(c.id, 'plano_vencendo', ate.toISOString().slice(0, 10), d.email, `Seu plano ${nome} vence ${dia(ate)}`, {
      previa: 'Esse pagamento não renova sozinho.',
      titulo: `Seu plano ${nome} vence ${dia(ate)}.`,
      paragrafos: [
        'Esse pagamento não renova sozinho. Para não parar de buscar comércios, pague de novo antes do vencimento: os dias novos se somam aos que ainda restam.',
        'Se preferir não se preocupar mais com isso, assine no cartão: renova todo mês e você cancela quando quiser.',
      ],
      botao: { texto: `Renovar o ${nome}`, url: `${SITE}/planos?plano=${c.plano}` },
    });
    if (ok) res.vencendo++;
  }

  for (const c of vencidos) {
    const d = quem.get(c.id);
    if (!d) continue;
    const plano = (c.plano === 'pago' ? 'pro' : c.plano) as Plano;
    const nome = NOME_DO_PLANO[plano];
    const ok = await enviarUmaVez(c.id, 'plano_vencido', new Date(c.pago_ate).toISOString().slice(0, 10), d.email, `Seu plano ${nome} venceu`, {
      previa: 'Seus leads e o CRM continuam salvos.',
      titulo: `Seu plano ${nome} venceu.`,
      paragrafos: [
        'Sua lista de leads, o CRM, as propostas e o Financeiro continuam salvos. O que parou foi a busca de comércios novos.',
        `Para voltar, é só pagar de novo: o ${nome} custa ${preco(plano)}${plano === 'semanal' ? ' por 7 dias' : ' por mês'}.`,
      ],
      botao: { texto: `Voltar ao ${nome}`, url: `${SITE}/planos?plano=${plano}` },
    });
    if (ok) res.vencido++;
  }

  for (const k of metade) {
    const d = quem.get(k.conta_id);
    if (!d) continue;
    const plano = k.plano as Plano;
    const nome = NOME_DO_PLANO[plano] || 'plano';
    const n = primeiroNome(d.nome);
    const ok = await enviarUmaVez(k.conta_id, 'compra_pela_metade', k.id, d.email, 'Ficou faltando só o pagamento', {
      previa: `Sua assinatura do ${nome} não foi concluída.`,
      titulo: n ? `${n}, ficou faltando só o pagamento.` : 'Ficou faltando só o pagamento.',
      paragrafos: [
        `Você abriu o pagamento do ${nome} (${preco(plano)}${plano === 'semanal' ? ' por 7 dias' : ' por mês'}) e ele não foi concluído.`,
        'Se deu algum problema com o cartão ou com o Pix, responda este e-mail que a gente ajuda.',
      ],
      botao: { texto: 'Concluir a assinatura', url: `${SITE}/planos?plano=${plano}` },
      sair: linkSair(k.conta_id),
    });
    if (ok) res.metade++;
  }
  return res;
}
