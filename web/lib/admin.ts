/**
 * O que só quem administra a ferramenta faz: ver os assinantes, mudar plano,
 * suspender conta, juntar alguém na sua equipe e trazer os leads do banco
 * antigo (Neon).
 *
 * Toda rota que chama isto confere antes `sessao.admin`, que vem da
 * variável ADMIN_EMAILS — não de algo gravado no banco.
 */

import { neon } from '@neondatabase/serverless';
import { db } from './sql';
import { semanaAtual, type Plano } from './conta';

export interface LinhaAssinante {
  contaId: string;
  nome: string;
  plano: Plano;
  pagoAte: string | null;
  bloqueada: boolean;
  legado: boolean;
  criadaEm: string;
  membros: { email: string; nome: string; papel: string }[];
  leads: number;
  semana: number;
}

export async function listarAssinantes(): Promise<LinhaAssinante[]> {
  const sql = db();
  const semana = semanaAtual();
  const r = await sql`
    select c.id, c.nome, c.plano, c.pago_ate, c.bloqueada, c.legado, c.criada_em,
      coalesce((select json_agg(json_build_object('email', public.email_do_usuario(m.user_id), 'nome', m.nome, 'papel', m.papel) order by m.papel)
                from membros m where m.conta_id = c.id), '[]') as membros,
      (select count(*)::int from leads l where l.conta_id = c.id) as leads,
      coalesce((select novos from uso_semanal s where s.conta_id = c.id and s.semana = ${semana}), 0) as semana
    from contas c
    order by c.criada_em desc
    limit 500
  `;
  return r.map((x) => ({
    contaId: x.id,
    nome: x.nome,
    plano: x.plano,
    pagoAte: x.pago_ate ? new Date(x.pago_ate).toISOString() : null,
    bloqueada: x.bloqueada,
    legado: x.legado,
    criadaEm: new Date(x.criada_em).toISOString(),
    membros: typeof x.membros === 'string' ? JSON.parse(x.membros) : x.membros,
    leads: x.leads,
    semana: x.semana,
  }));
}

export async function mudarConta(contaId: string, mudanca: { plano?: Plano; bloqueada?: boolean }): Promise<void> {
  const sql = db();
  if (mudanca.plano === 'basic' || mudanca.plano === 'pro') {
    // marcado à mão (pagamento por fora): vale 31 dias a partir de hoje, até a cobrança automática existir
    await sql`update contas set plano = ${mudanca.plano}, pago_ate = greatest(coalesce(pago_ate, now()), now()) + interval '31 days' where id = ${contaId}`;
  } else if (mudanca.plano) {
    await sql`update contas set plano = ${mudanca.plano} where id = ${contaId}`;
  }
  if (mudanca.bloqueada !== undefined) await sql`update contas set bloqueada = ${mudanca.bloqueada} where id = ${contaId}`;
}

/**
 * Põe uma pessoa já cadastrada dentro da conta do admin (como o João na
 * sua). Só junta quem ainda não tem leads na conta própria, para ninguém
 * perder trabalho sem querer; a conta vazia dela é apagada.
 */
export async function juntarNaConta(contaDestino: string, email: string): Promise<{ ok: boolean; erro?: string }> {
  const sql = db();
  const u = await sql`select public.usuario_pelo_email(${email.trim()}) as id`;
  if (!u[0]?.id) return { ok: false, erro: 'Ninguém com esse e-mail criou conta ainda. Peça para a pessoa se cadastrar primeiro.' };
  const userId = u[0].id as string;

  const atual = await sql`select conta_id from membros where user_id = ${userId}`;
  if (atual.length && atual[0].conta_id === contaDestino) return { ok: true };
  if (atual.length) {
    const n = await sql`select count(*)::int as n from leads where conta_id = ${atual[0].conta_id}`;
    if (n[0].n > 0) return { ok: false, erro: 'Essa pessoa já tem leads na conta dela. Junte manualmente para não perder nada.' };
  }

  const nome = (email.split('@')[0] || 'membro').toLowerCase().slice(0, 40);
  await sql.begin(async (tx) => {
    if (atual.length) {
      const antiga = atual[0].conta_id as string;
      await tx`delete from membros where user_id = ${userId}`;
      // a conta vazia que ela tinha some junto (só se não sobrou ninguém nela)
      await tx`delete from contas c where c.id = ${antiga} and not exists (select 1 from membros m where m.conta_id = c.id)`;
    }
    await tx`insert into membros (conta_id, user_id, nome, papel) values (${contaDestino}, ${userId}, ${nome}, 'membro')`;
    await tx`update chaves_extensao set conta_id = ${contaDestino} where user_id = ${userId}`;
  });
  return { ok: true };
}

/**
 * Traz os leads do Neon para a conta do admin, que vira a conta "legada"
 * (é nela que os links antigos de proposta são procurados) e ganha o plano
 * cortesia. Pode rodar mais de uma vez: o que já foi copiado é pulado.
 */
export async function migrarDoNeon(contaDestino: string): Promise<{ copiados: number; jaExistiam: number; bloqueios: number }> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
  if (!url) throw new Error('A variável DATABASE_URL (Neon) não está configurada nesta Vercel.');
  const neonSql = neon(url);
  const sql = db();

  const legada = await sql`select id from contas where legado = true`;
  if (legada.length && legada[0].id !== contaDestino) {
    throw new Error('Os leads antigos já foram trazidos para outra conta.');
  }
  await sql`update contas set legado = true, plano = 'cortesia' where id = ${contaDestino}`;

  let copiados = 0;
  let jaExistiam = 0;
  let depois = '';
  for (;;) {
    const lote = (await neonSql`select * from leads where id > ${depois} order by id limit 300`) as Record<string, unknown>[];
    if (!lote.length) break;
    for (const l of lote) {
      const j = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
      const r = await sql`
        insert into leads (
          conta_id, id, name, category, search_term, city, phone, address, website, website_kind, website_label,
          is_lead, rating, reviews, maps_url, lat, lng, hours, status, notes, site_status, site_detalhe,
          site_verificado_em, coletado_por, responsavel, proposta, instagram, origem, previa_url, cnpj, briefing,
          contato, contatado_em, created_at, updated_at
        ) values (
          ${contaDestino}, ${l.id as string}, ${l.name as string}, ${(l.category as string) ?? null}, ${(l.search_term as string) ?? null},
          ${(l.city as string) ?? null}, ${(l.phone as string) ?? null}, ${(l.address as string) ?? null}, ${(l.website as string) ?? null},
          ${(l.website_kind as string) || 'none'}, ${(l.website_label as string) ?? null}, ${l.is_lead !== false},
          ${(l.rating as number) ?? null}, ${(l.reviews as number) ?? null}, ${(l.maps_url as string) ?? null},
          ${(l.lat as number) ?? null}, ${(l.lng as number) ?? null}, ${(l.hours as string) ?? null},
          ${(l.status as string) || 'novo'}, ${(l.notes as string) ?? null}, ${(l.site_status as string) ?? null},
          ${(l.site_detalhe as string) ?? null}, ${(l.site_verificado_em as Date) ?? null}, ${(l.coletado_por as string) ?? null},
          ${(l.responsavel as string) ?? null}, ${j(l.proposta)}::jsonb, ${(l.instagram as string) ?? null},
          ${(l.origem as string) || 'maps'}, ${(l.previa_url as string) ?? null}, ${j(l.cnpj)}::jsonb, ${j(l.briefing)}::jsonb,
          ${l.contato === true}, ${(l.contatado_em as Date) ?? null}, ${(l.created_at as Date) ?? new Date()},
          ${(l.updated_at as Date) ?? new Date()}
        )
        on conflict (conta_id, id) do nothing
        returning id
      `;
      if (r.length) copiados++;
      else jaExistiam++;
    }
    depois = lote[lote.length - 1].id as string;
  }

  let bloqueios = 0;
  try {
    const b = (await neonSql`select ip, motivo, por, quando from bloqueios`) as Record<string, unknown>[];
    for (const x of b) {
      const r = await sql`
        insert into bloqueios (ip, motivo, por, quando)
        values (${x.ip as string}, ${(x.motivo as string) ?? null}, ${(x.por as string) ?? null}, ${(x.quando as Date) ?? new Date()})
        on conflict (ip) do nothing returning ip
      `;
      bloqueios += r.length;
    }
  } catch {
    // sem tabela de bloqueios no banco antigo: nada a trazer
  }

  return { copiados, jaExistiam, bloqueios };
}
