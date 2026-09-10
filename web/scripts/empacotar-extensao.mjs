/**
 * Empacota a pasta extension/ num .zip dentro de public/, para o painel
 * poder oferecer o download.
 *
 * Roda no prebuild, então o arquivo que o usuário baixa é sempre o mesmo
 * código que está no repositório — não existe zip velho commitado que
 * alguém esqueça de atualizar.
 *
 * O zip é escrito à mão com o zlib do próprio Node, sem dependência
 * externa: o build da Vercel é o lugar errado para descobrir que uma
 * biblioteca de compressão mudou de API.
 *
 * A pasta extension/ fica fora do Root Directory do projeto na Vercel e
 * só está visível porque "Include files outside the root directory in the
 * Build Step" está ligado. Se um dia não estiver, este script não derruba
 * o build: grava um metadado dizendo que o download está indisponível, e
 * a página avisa em vez de quebrar.
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_WEB = join(AQUI, '..');
const EXTENSAO = join(RAIZ_WEB, '..', 'extension');
const PUBLICO = join(RAIZ_WEB, 'public');
const ZIP = join(PUBLICO, 'vertion-leads-extensao.zip');
const INFO = join(RAIZ_WEB, 'lib', 'extensao-info.json');

const PASTA_NO_ZIP = 'vertion-leads-extensao';

// ---------------------------------------------------------------- zip

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** data/hora no formato MS-DOS que o cabeçalho do zip exige */
function dataDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

function montarZip(entradas) {
  const locais = [];
  const central = [];
  let offset = 0;

  for (const { nome, conteudo, mtime } of entradas) {
    const nomeBuf = Buffer.from(nome, 'utf8');
    const comprimido = deflateRawSync(conteudo, { level: 9 });
    const crc = crc32(conteudo);
    const { hora, data } = dataDos(mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);      // versão necessária
    local.writeUInt16LE(0x0800, 6);  // bit 11: nome em UTF-8
    local.writeUInt16LE(8, 8);       // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(conteudo.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28);

    locais.push(local, nomeBuf, comprimido);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);         // versão que criou
    cd.writeUInt16LE(20, 6);         // versão necessária
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(hora, 12);
    cd.writeUInt16LE(data, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comprimido.length, 20);
    cd.writeUInt32LE(conteudo.length, 24);
    cd.writeUInt16LE(nomeBuf.length, 28);
    cd.writeUInt16LE(0, 30);         // extra
    cd.writeUInt16LE(0, 32);         // comentário
    cd.writeUInt16LE(0, 34);         // disco
    cd.writeUInt16LE(0, 36);         // atributos internos
    // atributos externos (permissões unix). Multiplicação, não << 16:
    // o shift em JS trabalha com int32 com sinal e este valor estoura.
    cd.writeUInt32LE(0o100644 * 65536, 38);
    cd.writeUInt32LE(offset, 42);

    central.push(cd, nomeBuf);
    offset += local.length + nomeBuf.length + comprimido.length;
  }

  const corpo = Buffer.concat(locais);
  const diretorio = Buffer.concat(central);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(0, 4);                     // número do disco
  fim.writeUInt16LE(0, 6);                     // disco onde começa o diretório
  fim.writeUInt16LE(entradas.length, 8);       // entradas neste disco
  fim.writeUInt16LE(entradas.length, 10);      // entradas no total
  fim.writeUInt32LE(diretorio.length, 12);     // tamanho do diretório central
  fim.writeUInt32LE(corpo.length, 16);         // onde ele começa (byte 16, não 14)
  fim.writeUInt16LE(0, 20);                    // comentário

  return Buffer.concat([corpo, diretorio, fim]);
}

// --------------------------------------------------------------- main

const IGNORAR = new Set(['.DS_Store', 'Thumbs.db', 'node_modules', '.git']);

async function listar(dir, base = dir) {
  const itens = await readdir(dir, { withFileTypes: true });
  const saida = [];
  for (const item of itens) {
    if (IGNORAR.has(item.name)) continue;
    const caminho = join(dir, item.name);
    if (item.isDirectory()) {
      saida.push(...(await listar(caminho, base)));
    } else if (item.isFile()) {
      saida.push(caminho);
    }
  }
  return saida;
}

async function existe(caminho) {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

const gravarInfo = (dados) => writeFile(INFO, JSON.stringify(dados, null, 2) + '\n', 'utf8');

async function main() {
  if (!(await existe(EXTENSAO))) {
    console.warn('[extensao] pasta extension/ não encontrada — download ficará indisponível');
    return gravarInfo({ disponivel: false });
  }

  const manifest = JSON.parse(await readFile(join(EXTENSAO, 'manifest.json'), 'utf8'));
  const arquivos = await listar(EXTENSAO);

  const entradas = [];
  for (const caminho of arquivos) {
    const rel = relative(EXTENSAO, caminho).split(sep).join('/');
    entradas.push({
      nome: `${PASTA_NO_ZIP}/${rel}`,
      conteudo: await readFile(caminho),
      mtime: (await stat(caminho)).mtime,
    });
  }

  const zip = montarZip(entradas);
  await mkdir(PUBLICO, { recursive: true });
  await writeFile(ZIP, zip);

  await gravarInfo({
    disponivel: true,
    versao: manifest.version,
    nomeArquivo: 'vertion-leads-extensao.zip',
    tamanhoBytes: zip.length,
    arquivos: entradas.length,
    geradoEm: new Date().toISOString(),
  });

  console.log(`[extensao] v${manifest.version}: ${entradas.length} arquivos, ${(zip.length / 1024).toFixed(0)} KB`);
}

main().catch(async (err) => {
  // um problema aqui não pode derrubar o deploy do painel inteiro
  console.error('[extensao] falhou ao empacotar:', err.message);
  await gravarInfo({ disponivel: false }).catch(() => {});
});
