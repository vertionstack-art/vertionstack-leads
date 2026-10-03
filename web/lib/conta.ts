/**
 * Quem está usando a ferramenta, de que conta, em que plano, e quanto da
 * cota da semana ainda sobra.
 *
 * Duas portas levam a uma conta:
 *  - o navegador, pela sessão do Supabase Auth (cookie);
 *  - a extensão, pela chave que a pessoa gera em "Minha conta".
 *
 * Nenhuma das duas aceita a conta vinda do cliente. O que chega do
 * navegador é só "quem eu sou"; a conta sai do banco a partir disso.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './sql';
import { supabaseServidor } from './supabase-server';

/** leads novos por semana no plano grátis */
export const LIMITE_GRATIS = 10;
/** computadores por chave da extensão */
export const MAX_APARELHOS = 2;

export type Plano = 'gratis' | 'pago' | 'cortesia';

export interface Sessao {
  userId: string;
  email: string;
  /** como a pessoa aparece no painel (responsável, coletado por) */
  nome: string;
  contaId: string;
  contaNome: string;
  papel: 'dono' | 'membro';
  plano: Plano;
  /** pago em dia ou cortesia: sem limite semanal */
  ilimitado: boolean;
  pagoAte: string | null;
  bloqueada: boolean;
  admin: boolean;
}

// ------------------------------------------------------------- admin

/**
 * Quem cuida da ferramenta inteira (vê todos os assinantes, bloqueia IP,
 * roda a migração). Fica numa variável de ambiente, não no banco, para que
 * ninguém consiga se promover a administrador mexendo em dado.
 */
export function ehAdminEmail(email: string): boolean {
  const lista = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}

// ----------------------------------------------------------- plano

export function planoEfetivo(plano: string, pagoAte: Date | string | null): { plano: Plano; ilimitado: boolean } {
  if (plano === 'cortesia') return { plano: 'cortesia', ilimitado: true };
  if (plano === 'pago' && pagoAte && new Date(pagoAte).getTime() > Date.now()) return { plano: 'pago', ilimitado: true };
  // pago vencido cai para o grátis: continua usando, com limite
  return { plano: 'gratis', ilimitado: false };
}

// ---------------------------------------------------------- sessão

/** primeiro acesso de alguém que acabou de se cadastrar: cria a conta grátis dele */
async function criarContaPara(userId: string, nome: string): Promise<void> {
  const sql = db();
  await sql.begin(async (tx) => {
    const ja = await tx`select 1 from membros where user_id = ${userId}`;
    if (ja.length) return;
    const [c] = await tx`insert into contas (nome) values (${nome}) returning id`;
    await tx`insert into membros (conta_id, user_id, nome, papel) values (${c.id}, ${userId}, ${nome}, 'dono')`;
  });
}

function nomeDe(email: string, meta: Record<string, unknown> | undefined): string {
  const doCadastro = typeof meta?.nome === 'string' ? meta.nome : typeof meta?.full_name === 'string' ? meta.full_name : '';
  const base = (doCadastro || email.split('@')[0] || 'você').trim();
  return base.split(/\s+/)[0].toLowerCase().slice(0, 40);
}

export async function sessaoAtual(): Promise<Sessao | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await supabaseServidor();
  // getUser confere o token com o Supabase; getSession só leria o cookie
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email) return null;

  const sql = db();
  let linhas = await sql`
    select m.conta_id, m.nome, m.papel, c.nome as conta_nome, c.plano, c.pago_ate, c.bloqueada
    from membros m join contas c on c.id = m.conta_id
    where m.user_id = ${user.id}
  `;
  if (!linhas.length) {
    await criarContaPara(user.id, nomeDe(user.email, user.user_metadata));
    linhas = await sql`
      select m.conta_id, m.nome, m.papel, c.nome as conta_nome, c.plano, c.pago_ate, c.bloqueada
      from membros m join contas c on c.id = m.conta_id
      where m.user_id = ${user.id}
    `;
  }
  const r = linhas[0];
  const ef = planoEfetivo(r.plano, r.pago_ate);
  return {
    userId: user.id,
    email: user.email,
    nome: r.nome,
    contaId: r.conta_id,
    contaNome: r.conta_nome,
    papel: r.papel,
    plano: ef.plano,
    ilimitado: ef.ilimitado,
    pagoAte: r.pago_ate ? new Date(r.pago_ate).toISOString() : null,
    bloqueada: r.bloqueada,
    admin: ehAdminEmail(user.email),
  };
}

/** os nomes de quem divide a conta, para o filtro "de quem" do painel */
export async function equipeDaConta(conta: string): Promise<string[]> {
  const r = await db()`select nome from membros where conta_id = ${conta} order by nome`;
  return r.map((x) => x.nome as string);
}

// ------------------------------------------------------- cota grátis

/** a segunda-feira da semana atual, no horário de Brasília (AAAA-MM-DD) */
export function semanaAtual(agora = new Date()): string {
  const brasilia = new Date(agora.getTime() - 3 * 3600 * 1000);
  const diaDaSemana = (brasilia.getUTCDay() + 6) % 7; // segunda = 0
  const segunda = new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate() - diaDaSemana));
  return segunda.toISOString().slice(0, 10);
}

export interface Cota {
  ilimitado: boolean;
  usados: number;
  limite: number;
  restantes: number;
  /** quando a cota volta: a próxima segunda, 00h de Brasília */
  renovaEm: string;
}

export async function cotaDaConta(conta: string, ilimitado: boolean): Promise<Cota> {
  const semana = semanaAtual();
  const r = await db()`select novos from uso_semanal where conta_id = ${conta} and semana = ${semana}`;
  const usados = r.length ? (r[0].novos as number) : 0;
  const proxima = new Date(semana + 'T03:00:00Z');
  proxima.setUTCDate(proxima.getUTCDate() + 7);
  return {
    ilimitado,
    usados,
    limite: LIMITE_GRATIS,
    restantes: ilimitado ? Infinity : Math.max(0, LIMITE_GRATIS - usados),
    renovaEm: proxima.toISOString(),
  };
}

/**
 * Reserva até `pedidos` vagas da cota desta semana e devolve quantas
 * conseguiu. Numa conta ilimitada só conta (para o admin enxergar uso) e
 * devolve tudo.
 *
 * Feito numa instrução só, com trava na linha, para duas abas da extensão
 * mandando ao mesmo tempo não passarem as duas pelo mesmo resto de cota.
 */
export async function reservarCota(conta: string, pedidos: number, ilimitado: boolean): Promise<number> {
  if (pedidos <= 0) return 0;
  const semana = semanaAtual();
  const sql = db();
  await sql`insert into uso_semanal (conta_id, semana, novos) values (${conta}, ${semana}, 0) on conflict do nothing`;
  if (ilimitado) {
    await sql`update uso_semanal set novos = novos + ${pedidos} where conta_id = ${conta} and semana = ${semana}`;
    return pedidos;
  }
  const r = await sql`
    with antes as (
      select novos from uso_semanal where conta_id = ${conta} and semana = ${semana} for update
    )
    update uso_semanal u
       set novos = least(${LIMITE_GRATIS}, u.novos + ${pedidos})
      from antes
     where u.conta_id = ${conta} and u.semana = ${semana}
    returning u.novos - antes.novos as concedidos
  `;
  return r.length ? Math.max(0, r[0].concedidos as number) : 0;
}

/** devolve vagas reservadas que acabaram não sendo usadas (lead que já existia, por exemplo) */
export async function devolverCota(conta: string, quantos: number): Promise<void> {
  if (quantos <= 0) return;
  await db()`
    update uso_semanal set novos = greatest(0, novos - ${quantos})
    where conta_id = ${conta} and semana = ${semanaAtual()}
  `;
}

// ------------------------------------------------ chave da extensão

function hashDaChave(chave: string): string {
  return createHash('sha256').update('vertion-leads:chave:' + chave).digest('hex');
}

/** gera uma chave nova e revoga as anteriores desta pessoa; a chave só aparece aqui, uma vez */
export async function gerarChave(conta: string, userId: string): Promise<{ chave: string; prefixo: string }> {
  const chave = 'vl_' + randomBytes(24).toString('base64url');
  const prefixo = chave.slice(0, 7);
  const sql = db();
  await sql.begin(async (tx) => {
    await tx`update chaves_extensao set revogada_em = now() where user_id = ${userId} and revogada_em is null`;
    await tx`insert into chaves_extensao (conta_id, user_id, hash, prefixo) values (${conta}, ${userId}, ${hashDaChave(chave)}, ${prefixo})`;
  });
  return { chave, prefixo };
}

export async function revogarChaves(userId: string): Promise<void> {
  await db()`update chaves_extensao set revogada_em = now() where user_id = ${userId} and revogada_em is null`;
}

export interface InfoChave {
  id: string;
  prefixo: string;
  criadaEm: string;
  ultimoUso: string | null;
  aparelhos: { id: string; primeiroUso: string; ultimoUso: string }[];
}

export async function chaveAtiva(userId: string): Promise<InfoChave | null> {
  const sql = db();
  const r = await sql`
    select id, prefixo, criada_em, ultimo_uso from chaves_extensao
    where user_id = ${userId} and revogada_em is null
    order by criada_em desc limit 1
  `;
  if (!r.length) return null;
  const ap = await sql`
    select aparelho_id, primeiro_uso, ultimo_uso from aparelhos where chave_id = ${r[0].id} order by ultimo_uso desc
  `;
  return {
    id: r[0].id,
    prefixo: r[0].prefixo,
    criadaEm: new Date(r[0].criada_em).toISOString(),
    ultimoUso: r[0].ultimo_uso ? new Date(r[0].ultimo_uso).toISOString() : null,
    aparelhos: ap.map((a) => ({
      id: a.aparelho_id as string,
      primeiroUso: new Date(a.primeiro_uso).toISOString(),
      ultimoUso: new Date(a.ultimo_uso).toISOString(),
    })),
  };
}

/** tira um computador da chave — só da chave da própria pessoa */
export async function soltarAparelho(userId: string, aparelhoId: string): Promise<void> {
  await db()`
    delete from aparelhos a using chaves_extensao c
    where a.chave_id = c.id and c.user_id = ${userId} and a.aparelho_id = ${aparelhoId}
  `;
}

export interface Coletor {
  contaId: string;
  nome: string;
  ilimitado: boolean;
  plano: Plano;
}

export type ResultadoChave =
  | { ok: true; coletor: Coletor }
  | { ok: false; status: number; motivo: 'sem_chave' | 'chave_invalida' | 'conta_bloqueada' | 'aparelhos' | 'sem_aparelho'; erro: string };

/** chave antiga do INGEST_TOKEN, enquanto a extensão de quem já usava não for trocada */
function chaveLegada(enviada: string): boolean {
  const legadas = (process.env.INGEST_TOKEN || '')
    .split(',')
    .map((p) => p.trim())
    .map((p) => (p.includes(':') ? p.slice(p.indexOf(':') + 1) : p))
    .filter(Boolean);
  return legadas.some((s) => {
    const a = Buffer.from(s);
    const b = Buffer.from(enviada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Confere a chave e o computador de quem está mandando leads.
 *
 * O servidor é a trava de verdade: a extensão é código aberto no navegador
 * de qualquer um, então qualquer verificação feita lá dentro dá para tirar.
 * Aqui não.
 */
export async function coletorDaChave(req: Request): Promise<ResultadoChave> {
  const enviada = (req.headers.get('x-api-key') || '').trim();
  const aparelho = (req.headers.get('x-aparelho') || '').trim().slice(0, 80);
  if (!enviada) return { ok: false, status: 401, motivo: 'sem_chave', erro: 'Cole a sua chave nas configurações da extensão.' };

  const sql = db();

  if (chaveLegada(enviada)) {
    const r = await sql`select id, nome, plano, pago_ate from contas where legado = true order by criada_em limit 1`;
    if (r.length) {
      const ef = planoEfetivo(r[0].plano, r[0].pago_ate);
      return { ok: true, coletor: { contaId: r[0].id, nome: 'equipe', ...ef } };
    }
  }

  const r = await sql`
    select k.id, k.conta_id, m.nome, c.plano, c.pago_ate, c.bloqueada
    from chaves_extensao k
    join contas c on c.id = k.conta_id
    join membros m on m.user_id = k.user_id and m.conta_id = k.conta_id
    where k.hash = ${hashDaChave(enviada)} and k.revogada_em is null
  `;
  if (!r.length) {
    return { ok: false, status: 401, motivo: 'chave_invalida', erro: 'Chave inválida ou trocada. Copie a chave atual em Minha conta, no painel.' };
  }
  const k = r[0];
  if (k.bloqueada) return { ok: false, status: 403, motivo: 'conta_bloqueada', erro: 'Esta conta está suspensa. Fale com o suporte.' };

  if (!aparelho) {
    return { ok: false, status: 426, motivo: 'sem_aparelho', erro: 'Atualize a extensão para a versão mais nova (baixe de novo no painel).' };
  }
  const conhecido = await sql`select 1 from aparelhos where chave_id = ${k.id} and aparelho_id = ${aparelho}`;
  if (!conhecido.length) {
    const n = await sql`select count(*)::int as n from aparelhos where chave_id = ${k.id}`;
    if (n[0].n >= MAX_APARELHOS) {
      return {
        ok: false,
        status: 403,
        motivo: 'aparelhos',
        erro: `Esta chave já está em ${MAX_APARELHOS} computadores. Libere um em Minha conta, no painel.`,
      };
    }
    await sql`insert into aparelhos (chave_id, aparelho_id) values (${k.id}, ${aparelho}) on conflict do nothing`;
  } else {
    await sql`update aparelhos set ultimo_uso = now() where chave_id = ${k.id} and aparelho_id = ${aparelho}`;
  }
  await sql`update chaves_extensao set ultimo_uso = now() where id = ${k.id}`;

  const ef = planoEfetivo(k.plano, k.pago_ate);
  return { ok: true, coletor: { contaId: k.conta_id, nome: k.nome, ...ef } };
}

/** a conta que recebeu os leads de antes das contas existirem (links antigos de proposta) */
export async function contaLegada(): Promise<string | null> {
  const r = await db()`select id from contas where legado = true limit 1`;
  return r.length ? (r[0].id as string) : null;
}
