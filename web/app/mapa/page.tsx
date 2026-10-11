import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import MapaDosLeads from './mapa';

export const dynamic = 'force-dynamic';

export default async function PaginaMapa() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1440px] flex-col rounded-[var(--radius-folha)] bg-white px-5 pb-6 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Mapa dos leads</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">
              Onde estão os seus comércios. Bom para montar uma rota de visitas no mesmo bairro.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400">
            Voltar ao painel
          </Link>
        </header>
        <MapaDosLeads />
      </div>
    </div>
  );
}
