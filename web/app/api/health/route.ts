import { NextResponse } from 'next/server';
import { temBanco } from '@/lib/db';
import { chaveValida, exigeChave, exigeSenha } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A extensão bate aqui no "Testar conexão" para saber se está tudo de pé. */
export async function GET(req: Request) {
  const chaveOk = chaveValida(req);

  return NextResponse.json(
    {
      ok: chaveOk,
      database: temBanco ? 'postgres' : 'memoria',
      protegido: { chave: exigeChave, senha: exigeSenha },
      aviso: temBanco
        ? null
        : 'Sem DATABASE_URL: os leads não vão persistir. Conecte um banco Postgres na Vercel.',
    },
    { status: chaveOk ? 200 : 401 },
  );
}
