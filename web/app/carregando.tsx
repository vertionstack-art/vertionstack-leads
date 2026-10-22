import MenuLateral, { type Tela } from './menu-lateral';
import type { Cor } from './casca';

/**
 * O que aparece no instante do clique, enquanto o servidor monta a tela: o
 * mesmo trilho, a folha branca e o formato da página em cinza pulsando. A
 * pessoa vê na hora que o clique pegou, em vez de a tela antiga ficar parada.
 */

const FUNDO: Record<Cor, string> = {
  ceu: 'bg-ceu',
  rosa: 'bg-rosa',
  manteiga: 'bg-manteiga',
  lavanda: 'bg-lavanda',
  menta: 'bg-menta',
};

export default function Carregando({ tela, cor, titulo }: { tela: Tela; cor: Cor; titulo: string }) {
  const bloco = 'animate-pulse rounded-[24px] bg-zinc-100 motion-reduce:animate-none';
  return (
    <div className="min-h-screen md:pl-[104px]">
      <MenuLateral ativo={tela} conversas="lembrar" />
      <div className="px-3 pb-28 pt-3 md:py-3 md:pl-0 md:pr-3">
        <div className="min-h-[calc(100vh-24px)] rounded-[var(--radius-folha)] bg-white px-5 pb-10 pt-6 md:px-9 md:pt-8" aria-busy="true">
          <header className="flex items-center gap-3 md:gap-4">
            <span className={`h-11 w-11 shrink-0 rounded-[14px] ${FUNDO[cor]} md:h-14 md:w-14 md:rounded-[18px]`} />
            <div>
              <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">{titulo}</h1>
              <span className="mt-2.5 block h-3 w-56 animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none" />
            </div>
          </header>
          <p className="sr-only" role="status">Carregando {titulo}…</p>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-[104px] ${bloco}`} />
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className={`h-[340px] ${bloco}`} />
            <div className={`h-[340px] ${bloco}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
