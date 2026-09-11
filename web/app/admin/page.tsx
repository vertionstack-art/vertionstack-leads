import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dono, usuarioAtual } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import { temBanco } from '@/lib/db';
import PainelAcessos from './painel-acessos';

export const dynamic = 'force-dynamic';

export default async function PaginaAdmin() {
  const quem = await usuarioAtual();
  if (!quem) redirect('/login');

  const cabecalhos = await headers();
  const meuIp = ipDaRequisicao(cabecalhos);
  await registrarAcesso(cabecalhos, 'acessos', 'ok', quem, 15);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-roxo-600 ring-4 ring-roxo-100" />
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Acessos</h1>
              <p className="text-[11px] leading-tight text-zinc-500">quem entrou na ferramenta</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex min-h-[40px] items-center rounded-lg border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700"
          >
            &larr; Voltar ao painel
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        {quem !== dono ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13.5px] leading-relaxed text-amber-900">
            <b>Esta parte e so do dono do painel.</b> Quem cuida dos acessos e{' '}
            <b>{dono}</b> &mdash; o primeiro nome cadastrado na variavel USUARIOS. Se voce precisa
            entrar aqui, peca para inverter a ordem dos nomes la.
          </div>
        ) : (
          <>
            {!temBanco && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
                <b>Sem banco de dados.</b> O registro funciona, mas vive so na memoria do servidor
                e some a cada reinicio. Conecte o Postgres para guardar historico de verdade.
              </div>
            )}
            <PainelAcessos meuIp={meuIp} />
          </>
        )}
      </main>
    </div>
  );
}
