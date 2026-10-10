import Link from 'next/link';

/** a moldura das páginas de Termos e Privacidade: folha branca, texto confortável de ler */
export function DocumentoLegal({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  atualizado: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-3 py-3">
      <article className="mx-auto max-w-[820px] rounded-[var(--radius-folha)] bg-white px-6 pb-14 pt-8 md:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tinta text-[18px] font-extrabold text-white">V</span>
            <div>
              <h1 className="text-[26px] font-extrabold leading-none tracking-[-0.03em] md:text-[30px]">{titulo}</h1>
              <p className="mt-1.5 text-[12.5px] font-medium text-zinc-500">Vertion Leads · atualizado em {atualizado}</p>
            </div>
          </div>
          <nav className="flex gap-2 text-[13px] font-bold">
            <Link href="/termos" className="rounded-full border border-zinc-300 px-3.5 py-2 hover:border-zinc-500">Termos</Link>
            <Link href="/privacidade" className="rounded-full border border-zinc-300 px-3.5 py-2 hover:border-zinc-500">Privacidade</Link>
            <Link href="/" className="rounded-full bg-tinta px-3.5 py-2 text-white hover:bg-tinta-70">Voltar</Link>
          </nav>
        </header>
        <div className="legal mt-8 text-[14.5px] leading-[1.7] text-zinc-700">{children}</div>
      </article>
    </div>
  );
}

export function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-tinta">
        {n}. {titulo}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-zinc-400">
      {itens.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
