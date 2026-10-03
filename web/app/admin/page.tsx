import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { nivelDaSessao } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import PainelAcessos from './painel-acessos';
import PainelContas from './painel-contas';

export const dynamic = 'force-dynamic';

export default async function PaginaAdmin() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  // para quem não é administrador a página simplesmente não existe
  if (!sessao.admin) notFound();
  // a senha sozinha não abre a administração: precisa do código do Google Authenticator
  if ((await nivelDaSessao()) !== 'aal2') redirect('/admin/2fa');

  const cabecalhos = await headers();
  const meuIp = ipDaRequisicao(cabecalhos);
  await registrarAcesso(cabecalhos, 'acessos', 'ok', sessao.email, 15);

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1280px] rounded-[var(--radius-folha)] bg-white px-5 pb-10 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Administração</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">Assinantes, planos e quem entrou na ferramenta</p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>

        <PainelContas />

        <h2 className="mb-4 mt-12 text-[19px] font-extrabold tracking-[-0.02em]">Acessos</h2>
        <PainelAcessos meuIp={meuIp} />
      </div>
    </div>
  );
}
