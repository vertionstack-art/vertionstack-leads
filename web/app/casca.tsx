import MenuLateral, { type Tela } from './menu-lateral';

/**
 * A moldura das telas de dentro: o mesmo trilho preto do painel à esquerda,
 * a folha branca e um cabeçalho com o ícone da tela numa pastilha colorida.
 * Cada tela tem a sua cor (a mesma da pastilha), para a pessoa reconhecer
 * onde está só de bater o olho.
 */

export type Cor = 'ceu' | 'rosa' | 'manteiga' | 'lavanda' | 'menta';

const FUNDO: Record<Cor, string> = {
  ceu: 'bg-ceu',
  rosa: 'bg-rosa',
  manteiga: 'bg-manteiga',
  lavanda: 'bg-lavanda',
  menta: 'bg-menta',
};

export default function Casca({
  tela,
  conversas,
  titulo,
  subtitulo,
  icone,
  cor,
  acoes,
  children,
}: {
  tela: Tela;
  conversas: boolean;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  icone: React.ReactNode;
  cor: Cor;
  /** botões do lado direito do cabeçalho */
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:pl-[104px]">
      <MenuLateral ativo={tela} conversas={conversas} />
      <div className="px-3 pb-28 pt-3 md:py-3 md:pl-0 md:pr-3">
        <div className="min-h-[calc(100vh-24px)] overflow-x-clip rounded-[var(--radius-folha)] bg-white px-5 pb-10 pt-6 md:px-9 md:pt-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${FUNDO[cor]} text-tinta md:h-14 md:w-14 md:rounded-[18px]`}>{icone}</span>
              <div className="min-w-0">
                <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">{titulo}</h1>
                {subtitulo && <p className="mt-1.5 text-[13.5px] font-medium text-zinc-600">{subtitulo}</p>}
              </div>
            </div>
            {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
