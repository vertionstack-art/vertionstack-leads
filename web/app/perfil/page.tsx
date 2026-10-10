import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import PainelPerfil from './painel-perfil';
import { lerFoto } from '@/lib/perfil';

export const dynamic = 'force-dynamic';

export default async function PaginaPerfil() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const foto = await lerFoto(sessao.contaId, sessao.userId);

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1080px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Meu perfil</h1>
              <p className="mt-1.5 text-[13px] font-medium text-zinc-500">{sessao.email}</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>
        <PainelPerfil fotoInicial={foto} />
        <p className="mt-10 text-center text-[12px] font-medium text-zinc-500">
          <a href="/termos" className="hover:text-tinta hover:underline">Termos de uso</a>
          <span className="mx-2" aria-hidden>·</span>
          <a href="/privacidade" className="hover:text-tinta hover:underline">Política de privacidade</a>
        </p>
      </div>
    </div>
  );
}
