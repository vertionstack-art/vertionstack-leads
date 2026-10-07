/**
 * A moldura das telas de entrada (entrar, criar conta, senha): o cartão
 * preto com o que a ferramenta faz à esquerda e o formulário à direita.
 */

export const campo =
  'min-h-[48px] w-full rounded-full bg-zinc-100 px-5 text-[14px] font-medium outline-none transition-colors placeholder:text-zinc-600 focus:bg-white focus:ring-2 focus:ring-roxo-200';
export const rotulo = 'mb-2 mt-5 block text-[13px] font-bold';
export const botao =
  'mt-7 min-h-[48px] w-full rounded-full bg-tinta text-[14px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300';

export function Moldura({ titulo, subtitulo, children }: { titulo: string; subtitulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-[880px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.08)] md:grid-cols-[1fr_1.05fr]">
        <div className="relative isolate hidden flex-col overflow-hidden bg-tinta p-9 text-white md:flex">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-roxo-200 text-[20px] font-extrabold text-tinta">V</span>
          <h2 className="mt-auto text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">
            Quem ainda não tem{' '}
            <span className="inline-block -rotate-2 rounded-full border border-white/70 px-3 py-0.5">site próprio</span>{' '}
            na sua cidade.
          </h2>
          <p className="mt-3 max-w-[300px] text-[13.5px] leading-relaxed text-white/65">
            Do Google Maps até a proposta e o site entregue, num lugar só. Teste grátis com 30 leads, sem cartão.
          </p>
          <svg aria-hidden viewBox="0 0 160 120" className="absolute -right-10 -top-6 -z-10 h-[170px] w-[220px] text-white/20" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="40" y="20" width="110" height="80" rx="14" transform="rotate(-12 95 60)" />
            <rect x="20" y="34" width="110" height="80" rx="14" transform="rotate(-4 75 74)" />
          </svg>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tinta text-[18px] font-extrabold text-white">V</span>
            <span className="text-[15px] font-extrabold tracking-[-0.01em]">Vertion Leads</span>
          </div>
          <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">{titulo}</h1>
          <p className="mt-2 text-[13.5px] font-medium text-zinc-500">{subtitulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** chama uma rota de /api/auth e devolve a resposta já lida */
export async function postar(rota: string, corpo: Record<string, string>): Promise<{ ok: boolean; erro?: string; confirmar?: boolean }> {
  try {
    const r = await fetch(rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    return await r.json().catch(() => ({ ok: false, erro: 'Resposta inesperada do servidor.' }));
  } catch {
    return { ok: false, erro: 'Sem conexão. Confira a internet e tente de novo.' };
  }
}
