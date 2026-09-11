/**
 * Registro de quem bate na porta, e a lista de quem não entra.
 *
 * Um aviso que vale estar no código, porque muda o quanto se deve
 * confiar nisto: bloquear por IP segura pouco. IP residencial troca
 * quando o roteador reinicia, operadora de celular coloca dezenas de
 * clientes atrás do mesmo endereço (banir um bane todos), e qualquer VPN
 * contorna em segundos. Isto serve para enxergar movimento estranho e
 * cortar ruído — quem realmente protege o painel é a senha.
 */

import { neon } from '@neondatabase/serverless';

const URL_BANCO =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';

const sql = URL_BANCO ? neon(URL_BANCO) : null;

export type Resultado = 'ok' | 'senha_errada' | 'bloqueado' | 'chave_errada';

export interface Acesso {
  ip: string;
  rota: string;
  usuario: string | null;
  resultado: Resultado;
  cidade: string | null;
  pais: string | null;
  navegador: string | null;
  quando: string;
}

export interface ResumoPorIp {
  ip: string;
  acessos: number;
  falhas: number;
  usuarios: string[];
  cidade: string | null;
  pais: string | null;
  navegador: string | null;
  primeiro: string;
  ultimo: string;
  bloqueado: boolean;
  motivo: string | null;
}

// ------------------------------------------------------------ schema

let pronto = false;

async function garantir() {
  if (!sql || pronto) return;

  await sql`
    create table if not exists acessos (
      id         bigserial primary key,
      ip         text not null,
      rota       text not null,
      usuario    text,
      resultado  text not null default 'ok',
      cidade     text,
      pais       text,
      navegador  text,
      quando     timestamptz not null default now()
    )
  `;
  await sql`create index if not exists acessos_ip_idx on acessos (ip)`;
  await sql`create index if not exists acessos_quando_idx on acessos (quando desc)`;

  await sql`
    create table if not exists bloqueios (
      ip         text primary key,
      motivo     text,
      por        text,
      quando     timestamptz not null default now()
    )
  `;

  pronto = true;
}

// ------------------------------------------------- modo sem banco

/*
 * Sem DATABASE_URL o registro vive em memória, igual ao resto do sistema:
 * dá para testar na máquina antes de conectar o banco. Em produção isso
 * não serve — cada requisição pode cair num servidor diferente, e o
 * histórico ficaria picado — mas lá o Postgres sempre existe.
 */
const memoriaRef = globalThis as unknown as {
  __vlAcessos?: Acesso[];
  __vlBloqueios?: Map<string, string>;
};

const memAcessos = memoriaRef.__vlAcessos || (memoriaRef.__vlAcessos = []);
const memBloqueios = memoriaRef.__vlBloqueios || (memoriaRef.__vlBloqueios = new Map());

// --------------------------------------------------------- cabeçalhos

/**
 * O IP de quem pediu.
 *
 * Atrás da Vercel, quem chega no código é sempre o proxy dela: o endereço
 * real vem no x-forwarded-for, e o primeiro da lista é o do visitante —
 * os seguintes são os saltos pelo caminho.
 */
export function ipDaRequisicao(req: Request | Headers): string {
  const h = req instanceof Headers ? req : req.headers;
  const encadeado = h.get('x-forwarded-for') || '';
  const primeiro = encadeado.split(',')[0]?.trim();
  return primeiro || h.get('x-real-ip') || h.get('x-vercel-forwarded-for') || 'desconhecido';
}

export function contextoDaRequisicao(req: Request | Headers) {
  const h = req instanceof Headers ? req : req.headers;
  const ua = h.get('user-agent') || '';
  return {
    ip: ipDaRequisicao(h),
    // a Vercel resolve a localização na borda e manda junto, sem custo
    cidade: decodeURIComponent(h.get('x-vercel-ip-city') || '') || null,
    pais: h.get('x-vercel-ip-country') || null,
    navegador: ua ? ua.slice(0, 250) : null,
  };
}

// ------------------------------------------------------------ leitura

/**
 * A lista de bloqueados fica em memória por meio minuto.
 *
 * Ela é consultada em toda requisição; ir ao banco sempre significaria
 * uma viagem de rede extra por página carregada, para um dado que muda
 * uma vez por semana.
 */
let cacheBloqueios: { ips: Set<string>; ate: number } = { ips: new Set(), ate: 0 };

export async function ipsBloqueados(): Promise<Set<string>> {
  if (!sql) return new Set(memBloqueios.keys());
  if (Date.now() < cacheBloqueios.ate) return cacheBloqueios.ips;

  await garantir();
  const linhas = await sql`select ip from bloqueios`;
  const ips = new Set((linhas as { ip: string }[]).map((r) => r.ip));
  cacheBloqueios = { ips, ate: Date.now() + 30_000 };
  return ips;
}

export async function estaBloqueado(ip: string): Promise<boolean> {
  return (await ipsBloqueados()).has(ip);
}

// ------------------------------------------------------------ escrita

export async function registrarAcesso(
  req: Request | Headers,
  rota: string,
  resultado: Resultado = 'ok',
  usuario: string | null = null,
): Promise<void> {
  if (!sql) {
    const c = contextoDaRequisicao(req);
    memAcessos.unshift({ ...c, rota, usuario, resultado, quando: new Date().toISOString() });
    memAcessos.length = Math.min(memAcessos.length, 500);
    return;
  }
  try {
    await garantir();
    const c = contextoDaRequisicao(req);
    await sql`
      insert into acessos (ip, rota, usuario, resultado, cidade, pais, navegador)
      values (${c.ip}, ${rota}, ${usuario}, ${resultado}, ${c.cidade}, ${c.pais}, ${c.navegador})
    `;
  } catch (err) {
    // registro é acessório: nunca pode derrubar a página que ele observa
    console.error('[acessos]', (err as Error).message);
  }
}

export async function bloquear(ip: string, motivo: string, por: string): Promise<void> {
  if (!sql) { memBloqueios.set(ip, motivo); return; }
  await garantir();
  await sql`
    insert into bloqueios (ip, motivo, por) values (${ip}, ${motivo || null}, ${por})
    on conflict (ip) do update set motivo = excluded.motivo, por = excluded.por, quando = now()
  `;
  cacheBloqueios.ate = 0;
}

export async function desbloquear(ip: string): Promise<void> {
  if (!sql) { memBloqueios.delete(ip); return; }
  await garantir();
  await sql`delete from bloqueios where ip = ${ip}`;
  cacheBloqueios.ate = 0;
}

// ------------------------------------------------------------ painel

/* eslint-disable @typescript-eslint/no-explicit-any */

/** um resumo por endereço, que é como se olha para isto na prática */
export async function resumoPorIp(limite = 200): Promise<ResumoPorIp[]> {
  if (!sql) return resumoDaMemoria(limite);
  await garantir();

  const linhas = await sql`
    select
      a.ip,
      count(*)::int                                             as acessos,
      count(*) filter (where a.resultado <> 'ok')::int           as falhas,
      array_remove(array_agg(distinct a.usuario), null)          as usuarios,
      max(a.cidade)                                              as cidade,
      max(a.pais)                                                as pais,
      max(a.navegador)                                           as navegador,
      min(a.quando)                                              as primeiro,
      max(a.quando)                                              as ultimo,
      (b.ip is not null)                                         as bloqueado,
      max(b.motivo)                                              as motivo
    from acessos a
    left join bloqueios b on b.ip = a.ip
    group by a.ip, b.ip
    order by max(a.quando) desc
    limit ${limite}
  `;

  return (linhas as any[]).map((r) => ({
    ip: r.ip,
    acessos: r.acessos,
    falhas: r.falhas,
    usuarios: r.usuarios || [],
    cidade: r.cidade,
    pais: r.pais,
    navegador: r.navegador,
    primeiro: new Date(r.primeiro).toISOString(),
    ultimo: new Date(r.ultimo).toISOString(),
    bloqueado: Boolean(r.bloqueado),
    motivo: r.motivo,
  }));
}

/** o histórico cru, para quando o resumo não basta */
export async function ultimosAcessos(limite = 100, ip?: string): Promise<Acesso[]> {
  if (!sql) return (ip ? memAcessos.filter((a) => a.ip === ip) : memAcessos).slice(0, limite);
  await garantir();

  const linhas = ip
    ? await sql`select * from acessos where ip = ${ip} order by quando desc limit ${limite}`
    : await sql`select * from acessos order by quando desc limit ${limite}`;

  return (linhas as any[]).map((r) => ({
    ip: r.ip,
    rota: r.rota,
    usuario: r.usuario,
    resultado: r.resultado,
    cidade: r.cidade,
    pais: r.pais,
    navegador: r.navegador,
    quando: new Date(r.quando).toISOString(),
  }));
}

function resumoDaMemoria(limite: number): ResumoPorIp[] {
  const porIp = new Map<string, ResumoPorIp>();

  for (const a of memAcessos) {
    const atual = porIp.get(a.ip);
    if (atual) {
      atual.acessos++;
      if (a.resultado !== 'ok') atual.falhas++;
      if (a.usuario && !atual.usuarios.includes(a.usuario)) atual.usuarios.push(a.usuario);
      if (a.quando < atual.primeiro) atual.primeiro = a.quando;
      if (a.quando > atual.ultimo) atual.ultimo = a.quando;
    } else {
      porIp.set(a.ip, {
        ip: a.ip,
        acessos: 1,
        falhas: a.resultado === 'ok' ? 0 : 1,
        usuarios: a.usuario ? [a.usuario] : [],
        cidade: a.cidade,
        pais: a.pais,
        navegador: a.navegador,
        primeiro: a.quando,
        ultimo: a.quando,
        bloqueado: memBloqueios.has(a.ip),
        motivo: memBloqueios.get(a.ip) || null,
      });
    }
  }

  return Array.from(porIp.values())
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo))
    .slice(0, limite);
}

/** apaga registros velhos — não faz sentido guardar isto para sempre */
export async function limparAntigos(dias = 90): Promise<number> {
  if (!sql) return 0;
  await garantir();
  const r = await sql`delete from acessos where quando < now() - ${`${dias} days`}::interval returning id`;
  return r.length;
}
