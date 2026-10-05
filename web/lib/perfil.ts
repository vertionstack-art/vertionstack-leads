/**
 * O perfil de quem usa a ferramenta: o nome com que aparece no painel e os
 * dados da empresa dele, que saem na proposta enviada ao cliente.
 *
 * Antes disso toda proposta saía como "Vertion Stack": um assinante que
 * mandasse orçamento ao cliente dele estaria assinando com o nome de outra
 * empresa.
 */

import { db } from './sql';

export interface Perfil {
  nome: string;
  empresaNome: string;
  empresaWhatsapp: string;
  empresaEmail: string;
  empresaSite: string;
  empresaCidade: string;
  empresaDocumento: string;
  /** meta de vendas do mês, em reais inteiros; 0 = sem meta */
  metaMensal: number;
}

export interface DadosDaEmpresa {
  nome: string;
  telefone: string;
  email: string;
  site: string;
}

export async function lerPerfil(contaId: string, userId: string): Promise<Perfil> {
  const r = await db()`
    select m.nome, c.empresa_nome, c.empresa_whatsapp, c.empresa_email, c.empresa_site, c.empresa_cidade,
           c.empresa_documento, c.meta_mensal_centavos
    from membros m join contas c on c.id = m.conta_id
    where m.conta_id = ${contaId} and m.user_id = ${userId}
  `;
  const x = r[0] || {};
  return {
    nome: x.nome || '',
    empresaNome: x.empresa_nome || '',
    empresaWhatsapp: x.empresa_whatsapp || '',
    empresaEmail: x.empresa_email || '',
    empresaSite: x.empresa_site || '',
    empresaCidade: x.empresa_cidade || '',
    empresaDocumento: x.empresa_documento || '',
    metaMensal: x.meta_mensal_centavos ? Math.round(x.meta_mensal_centavos / 100) : 0,
  };
}

function texto(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

/** limpa e confere tudo o que veio do formulário; devolve o erro em português ou o perfil pronto */
export function validarPerfil(cru: Record<string, unknown>): { ok: true; perfil: Perfil } | { ok: false; erro: string } {
  const nome = texto(cru.nome, 40);
  if (!nome) return { ok: false, erro: 'Diga como você quer aparecer no painel.' };

  const empresaEmail = texto(cru.empresaEmail, 120).toLowerCase();
  if (empresaEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(empresaEmail)) return { ok: false, erro: 'O e-mail da empresa não parece certo.' };

  let empresaSite = texto(cru.empresaSite, 200);
  if (empresaSite && !/^https?:\/\//i.test(empresaSite)) empresaSite = 'https://' + empresaSite;
  if (empresaSite) {
    try {
      const u = new URL(empresaSite);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error();
    } catch {
      return { ok: false, erro: 'O site precisa ser um endereço, como suaempresa.com.br.' };
    }
  }

  const empresaWhatsapp = texto(cru.empresaWhatsapp, 30).replace(/[^\d+()\-\s]/g, '');
  const empresaDocumento = texto(cru.empresaDocumento, 20).replace(/[^\d./-]/g, '');
  const meta = Math.round(Number(cru.metaMensal) || 0);
  if (meta < 0 || meta > 10_000_000) return { ok: false, erro: 'A meta precisa ser um valor entre 0 e 10 milhões.' };

  return {
    ok: true,
    perfil: {
      nome,
      empresaNome: texto(cru.empresaNome, 80),
      empresaWhatsapp,
      empresaEmail,
      empresaSite,
      empresaCidade: texto(cru.empresaCidade, 80),
      empresaDocumento,
      metaMensal: meta,
    },
  };
}

export async function salvarPerfil(contaId: string, userId: string, p: Perfil, podeEditarEmpresa: boolean): Promise<void> {
  const sql = db();
  await sql`update membros set nome = ${p.nome} where conta_id = ${contaId} and user_id = ${userId}`;
  // os dados da empresa são da conta: só o dono muda, para um membro não trocar a assinatura das propostas de todos
  if (!podeEditarEmpresa) return;
  await sql`
    update contas set
      nome = coalesce(nullif(${p.empresaNome}, ''), nome),
      empresa_nome = nullif(${p.empresaNome}, ''),
      empresa_whatsapp = nullif(${p.empresaWhatsapp}, ''),
      empresa_email = nullif(${p.empresaEmail}, ''),
      empresa_site = nullif(${p.empresaSite}, ''),
      empresa_cidade = nullif(${p.empresaCidade}, ''),
      empresa_documento = nullif(${p.empresaDocumento}, ''),
      meta_mensal_centavos = ${p.metaMensal ? p.metaMensal * 100 : null}
    where id = ${contaId}
  `;
}

/**
 * O que a proposta mostra como "quem está oferecendo". A conta legada (a da
 * Vertion, com os links antigos) cai nas variáveis de ambiente de sempre.
 */
export async function empresaDaConta(contaId: string): Promise<DadosDaEmpresa> {
  const r = await db()`
    select empresa_nome, empresa_whatsapp, empresa_email, empresa_site, legado, nome from contas where id = ${contaId}
  `;
  const c = r[0] || {};
  const doAmbiente = {
    nome: process.env.EMPRESA_NOME || 'Vertion Stack',
    telefone: process.env.EMPRESA_TELEFONE || '',
    email: process.env.EMPRESA_EMAIL || '',
    site: process.env.EMPRESA_SITE || '',
  };
  if (c.legado && !c.empresa_nome) return doAmbiente;
  return {
    nome: c.empresa_nome || c.nome || doAmbiente.nome,
    telefone: c.empresa_whatsapp || '',
    email: c.empresa_email || '',
    site: c.empresa_site || '',
  };
}

// ------------------------------------------------------------- foto

const TETO_FOTO = 300_000;

/**
 * Confere a foto antes de gravar: só JPEG, PNG ou WebP em base64, dentro do
 * teto, e os primeiros bytes têm de ser mesmo de imagem — um texto qualquer
 * com cabeçalho "data:image" não passa.
 */
export function validarFoto(v: unknown): string | null {
  const s = String(v || '');
  const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m || s.length > TETO_FOTO) return null;
  const bytes = Buffer.from(m[2].slice(0, 32), 'base64');
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const confere = (m[1] === 'png' && png) || (m[1] === 'jpeg' && jpeg) || (m[1] === 'webp' && webp);
  return confere ? s : null;
}

export async function lerFoto(contaId: string, userId: string): Promise<string | null> {
  const r = await db()`select foto from membros where conta_id = ${contaId} and user_id = ${userId}`;
  return (r[0]?.foto as string) || null;
}

export async function salvarFoto(contaId: string, userId: string, foto: string | null): Promise<void> {
  await db()`update membros set foto = ${foto} where conta_id = ${contaId} and user_id = ${userId}`;
}
