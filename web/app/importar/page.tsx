import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cotaDaConta, sessaoAtual } from '@/lib/conta';
import Importar from './importar';

export const dynamic = 'force-dynamic';

export default async function PaginaImportar() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const cota = await cotaDaConta(sessao.contaId, sessao.plano);
  const vagas = cota.ilimitado ? null : Math.max(0, cota.tetoGuardados - cota.guardados);

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1080px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Importar planilha</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">
              Traga a sua própria lista de comércios. Ela não gasta a cota de leads da semana.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>
        <Importar vagas={vagas} />
      </div>
    </div>
  );
}
