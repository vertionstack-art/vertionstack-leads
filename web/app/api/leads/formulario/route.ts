import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { exigirSessao } from '@/lib/auth';
import { db } from '@/lib/sql';
import {
  CAMPOS, NOME_NO_PDF, OPCOES_INTERESSE, OPCOES_TIPO, ROTULO_IDEIA, ROTULO_OUTRO, ROTULO_REUNIAO, textoParaWhatsapp,
} from '@/lib/formulario-cadastro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A ficha de cadastro em branco para o cliente preencher: ?formato=texto
 * devolve a mensagem do WhatsApp; sem isso, o PDF com campos de digitar e
 * caixinhas de marcar (a pessoa preenche no leitor de PDF e devolve o
 * arquivo). O nome da empresa da conta vai no título.
 */
export async function GET(req: Request) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const [c] = await db()`select empresa_nome from contas where id = ${s.sessao.contaId}`;
  const empresa = ((c?.empresa_nome as string) || '').trim() || null;

  if (new URL(req.url).searchParams.get('formato') === 'texto') {
    return NextResponse.json({ ok: true, texto: textoParaWhatsapp(empresa) });
  }

  const pdf = await montarPdf(empresa);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ficha-de-cadastro.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

const TINTA = rgb(0x0b / 255, 0x0b / 255, 0x0f / 255);
const CINZA = rgb(0x52 / 255, 0x52 / 255, 0x5b / 255);
const BORDA = rgb(0xd4 / 255, 0xd4 / 255, 0xd8 / 255);
const CAMPO = rgb(0xfa / 255, 0xfa / 255, 0xfb / 255);
const LAVANDA = rgb(0xe8 / 255, 0xe3 / 255, 0xfa / 255);
const ROXO = rgb(0x8f / 255, 0x00 / 255, 0xff / 255);
const BRANCO = rgb(1, 1, 1);

const L = 595.28;
const A = 841.89;
const M = 44;

async function montarPdf(empresa: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ficha de cadastro${empresa ? ` — ${empresa}` : ''}`);
  doc.setCreator('Vertion Leads');
  const page = doc.addPage([L, A]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();

  // ------------------------------------------------------------ cabeçalho
  page.drawRectangle({ x: 0, y: A - 88, width: L, height: 88, color: TINTA });
  page.drawRectangle({ x: M, y: A - 88, width: 56, height: 4, color: ROXO });
  page.drawText('Ficha de cadastro', { x: M, y: A - 48, size: 24, font: negrito, color: BRANCO });
  page.drawText(
    empresa ? `${empresa} · preencha e devolva este arquivo` : 'Preencha e devolva este arquivo',
    { x: M, y: A - 70, size: 10.5, font: normal, color: rgb(0.8, 0.8, 0.84) },
  );

  let y = A - 112;

  // ------------------------------------------------------------ você é
  y = titulo(page, negrito, 'Você é', y);
  let x = M;
  for (const o of OPCOES_TIPO) {
    caixinha(form, page, NOME_NO_PDF.tipo(o.id), x, y - 14);
    page.drawText(o.rotulo, { x: x + 20, y: y - 10, size: 10.5, font: normal, color: TINTA });
    x += 190;
  }
  y -= 38;

  // ------------------------------------------------------------ dados, duas colunas
  y = titulo(page, negrito, 'Seus dados', y);
  const coluna = (L - M * 2 - 16) / 2;
  CAMPOS.forEach((c, i) => {
    const col = i % 2;
    const linha = Math.floor(i / 2);
    const cx = M + col * (coluna + 16);
    const cy = y - linha * 42;
    rotulo(page, normal, negrito, c.rotulo, c.dica, cx, cy);
    texto(form, page, normal, c.id, cx, cy - 30, coluna, 22);
  });
  y -= Math.ceil(CAMPOS.length / 2) * 42 + 10;

  // ------------------------------------------------------------ o que precisa
  y = titulo(page, negrito, 'O que você precisa?', y, 'pode marcar mais de um');
  const larg = (L - M * 2) / 3;
  OPCOES_INTERESSE.forEach((o, i) => {
    const cx = M + (i % 3) * larg;
    const cy = y - Math.floor(i / 3) * 22;
    caixinha(form, page, NOME_NO_PDF.interesse(o.id), cx, cy - 14);
    page.drawText(o.rotulo, { x: cx + 20, y: cy - 10, size: 10, font: normal, color: TINTA });
  });
  y -= Math.ceil(OPCOES_INTERESSE.length / 3) * 22 + 6;
  page.drawText(`${ROTULO_OUTRO}:`, { x: M, y: y - 16, size: 10, font: negrito, color: TINTA });
  texto(form, page, normal, 'outro', M + 42, y - 22, L - M * 2 - 42, 20);
  y -= 44;

  // ------------------------------------------------------------ ideia
  y = titulo(page, negrito, ROTULO_IDEIA, y, 'para que serve, o que precisa ter, referências, prazo');
  const ideia = texto(form, page, normal, 'ideia', M, y - 88, L - M * 2, 84);
  ideia.enableMultiline();
  ideia.setFontSize(10);
  y -= 100;

  // ------------------------------------------------------------ reunião
  y = titulo(page, negrito, ROTULO_REUNIAO, y);
  texto(form, page, normal, 'reuniao', M, y - 26, L - M * 2, 22);

  // ------------------------------------------------------------ rodapé
  page.drawRectangle({ x: M, y: 30, width: L - M * 2, height: 26, color: LAVANDA });
  page.drawText('No celular: abra pelo app Arquivos (iPhone) ou pelo Google Drive (Android) para conseguir digitar.', {
    x: M + 12, y: 39, size: 8.5, font: normal, color: TINTA,
  });

  form.updateFieldAppearances(normal);
  return doc.save();
}

function titulo(page: PDFPage, negrito: PDFFont, t: string, y: number, dica?: string): number {
  page.drawText(t, { x: M, y: y - 12, size: 12.5, font: negrito, color: TINTA });
  if (dica) {
    const w = negrito.widthOfTextAtSize(t, 12.5);
    page.drawText(`(${dica})`, { x: M + w + 8, y: y - 12, size: 9, font: negrito, color: CINZA });
  }
  return y - 24;
}

function rotulo(page: PDFPage, normal: PDFFont, negrito: PDFFont, t: string, dica: string | undefined, x: number, y: number) {
  page.drawText(t, { x, y: y - 6, size: 9.5, font: negrito, color: TINTA });
  if (dica) page.drawText(`(${dica})`, { x: x + negrito.widthOfTextAtSize(t, 9.5) + 5, y: y - 6, size: 8.5, font: normal, color: CINZA });
}

function texto(
  form: ReturnType<PDFDocument['getForm']>, page: PDFPage, fonte: PDFFont,
  nome: string, x: number, y: number, width: number, height: number,
) {
  const f = form.createTextField(nome);
  f.addToPage(page, { x, y, width, height, font: fonte, borderColor: BORDA, backgroundColor: CAMPO, borderWidth: 1, textColor: TINTA });
  f.setFontSize(10.5);
  return f;
}

function caixinha(form: ReturnType<PDFDocument['getForm']>, page: PDFPage, nome: string, x: number, y: number) {
  form.createCheckBox(nome).addToPage(page, { x, y, width: 14, height: 14, borderColor: TINTA, borderWidth: 1, backgroundColor: BRANCO, textColor: TINTA });
}
