/**
 * Quem entra no painel e quem pode mandar leads para ele.
 *
 * Duas portas, cada uma com sua chave:
 *
 *  - pessoas entram com usuário e senha  (variável USUARIOS)
 *  - extensões mandam leads com uma chave (variável INGEST_TOKEN)
 *
 * Nas duas variáveis dá para cadastrar mais de uma pessoa, separando por
 * vírgula no formato `nome:valor`:
 *
 *   USUARIOS=lucas:umaSenha,joao:outraSenha
 *   INGEST_TOKEN=lucas:vl_aaa...,joao:vl_bbb...
 *
 * Cada um com sua chave própria é o que permite o painel dizer quem
 * coletou cada lead e quem está cuidando dele. Também deixa tirar o acesso
 * de uma pessoa sem trocar o de todo mundo.
 *
 * O formato antigo de valor único continua valendo: uma DASHBOARD_PASSWORD
 * sozinha vira o usuário "equipe", e um INGEST_TOKEN sem nome vira o
 * coletor "equipe". Ninguém precisa refazer o que já estava configurado.
 */

import { cookies } from 'next/headers';

export const COOKIE = 'vl_sessao';

export interface Pessoa {
  nome: string;
  segredo: string;
}

/**
 * Lê "nome:valor,nome:valor" ou um valor solto.
 * O valor pode conter ":" (uma senha com dois-pontos, por exemplo), então
 * a divisão acontece só no primeiro separador.
 */
function lerLista(bruto: string, nomePadrao: string): Pessoa[] {
  const texto = (bruto || '').trim();
  if (!texto) return [];

  return texto
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((parte) => {
      const corte = parte.indexOf(':');
      if (corte === -1) return { nome: nomePadrao, segredo: parte };
      const nome = parte.slice(0, corte).trim().toLowerCase();
      const segredo = parte.slice(corte + 1).trim();
      return nome && segredo ? { nome, segredo } : null;
    })
    .filter((p): p is Pessoa => p !== null);
}

const USUARIOS = lerLista(process.env.USUARIOS || process.env.DASHBOARD_PASSWORD || '', 'equipe');
const COLETORES = lerLista(process.env.INGEST_TOKEN || '', 'equipe');

export const exigeSenha = USUARIOS.length > 0;
export const exigeChave = COLETORES.length > 0;

/** os nomes cadastrados, para o painel poder oferecer o filtro por pessoa */
export const nomesDaEquipe = Array.from(
  new Set([...USUARIOS.map((u) => u.nome), ...COLETORES.map((c) => c.nome)]),
).sort();

/**
 * O dono é o primeiro nome cadastrado em USUARIOS.
 *
 * Alguém precisa decidir quem entra e quem é bloqueado, e num time de
 * duas pessoas criar um sistema de papéis seria peso sem uso: quem montou
 * o painel é quem cuida dele.
 */
export const dono = USUARIOS[0]?.nome || 'equipe';

export async function ehDono(): Promise<boolean> {
  const quem = await usuarioAtual();
  return quem !== null && quem === dono;
}

/** comparação em tempo constante, para não vazar o segredo pelo tempo de resposta */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function hash(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vertion-leads:' + texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ------------------------------------------------------ extensão

/** devolve o nome de quem mandou os leads, ou null se a chave não confere */
export function quemEnviou(req: Request): string | null {
  if (!exigeChave) return 'equipe';
  const enviada = req.headers.get('x-api-key') || '';
  const dono = COLETORES.find((c) => iguais(enviada, c.segredo));
  return dono ? dono.nome : null;
}

export function chaveValida(req: Request): boolean {
  return quemEnviou(req) !== null;
}

// --------------------------------------------------------- painel

/**
 * O cookie guarda "nome.assinatura", e a assinatura é o hash do nome com a
 * senha da pessoa. Assim o próprio cookie diz quem é, e trocar a senha de
 * alguém invalida a sessão dela sem mexer na de mais ninguém.
 */
async function assinatura(p: Pessoa): Promise<string> {
  return hash(p.nome + ':' + p.segredo);
}

export async function entrar(nome: string, senha: string): Promise<string | null> {
  const alvo = (nome || '').trim().toLowerCase();

  // com uma pessoa só cadastrada, o nome é opcional na tela de login
  const candidatos = alvo ? USUARIOS.filter((u) => u.nome === alvo) : USUARIOS;

  for (const u of candidatos) {
    if (iguais(senha, u.segredo)) return `${u.nome}.${await assinatura(u)}`;
  }
  return null;
}

/** o nome de quem está logado, ou null */
export async function usuarioAtual(): Promise<string | null> {
  if (!exigeSenha) return 'equipe';

  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value || '';
  const corte = valor.lastIndexOf('.');
  if (corte === -1) return null;

  const nome = valor.slice(0, corte);
  const assinado = valor.slice(corte + 1);

  const u = USUARIOS.find((x) => x.nome === nome);
  if (!u) return null;

  return iguais(assinado, await assinatura(u)) ? u.nome : null;
}

export async function estaLogado(): Promise<boolean> {
  return (await usuarioAtual()) !== null;
}

/** aceita quem tem sessão no navegador OU a chave de uma extensão */
export async function podeLer(req: Request): Promise<boolean> {
  if (await estaLogado()) return true;
  return exigeChave && chaveValida(req);
}
