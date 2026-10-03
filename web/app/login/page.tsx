'use client';

import { useState } from 'react';

export default function Login() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, senha }),
    });

    if (r.ok) {
      // navegação do próprio navegador, não router.push: a rota "/" é um
      // server component que já foi buscado uma vez sem o cookie, e o
      // roteador serviria essa cópia em cache — devolvendo o login de novo
      window.location.href = '/';
    } else {
      const d = await r.json().catch(() => ({}));
      setErro(d.erro || 'Não consegui entrar.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-[860px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.08)] md:grid-cols-[1fr_1.05fr]">
        {/* o lado preto: o mesmo cartão escuro do painel, com o que a ferramenta faz */}
        <div className="relative isolate hidden flex-col overflow-hidden bg-tinta p-9 text-white md:flex">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-roxo-200 text-[20px] font-extrabold text-tinta">V</span>
          <h2 className="mt-auto text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">
            Quem ainda não tem{' '}
            <span className="inline-block -rotate-2 rounded-full border border-white/70 px-3 py-0.5">site próprio</span>{' '}
            na sua cidade.
          </h2>
          <p className="mt-3 max-w-[300px] text-[13.5px] leading-relaxed text-white/65">
            Do Google Maps até a proposta e o site entregue, num lugar só.
          </p>
          <svg aria-hidden viewBox="0 0 160 120" className="absolute -right-10 -top-6 -z-10 h-[170px] w-[220px] text-white/20" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="40" y="20" width="110" height="80" rx="14" transform="rotate(-12 95 60)" />
            <rect x="20" y="34" width="110" height="80" rx="14" transform="rotate(-4 75 74)" />
          </svg>
        </div>

        <form onSubmit={entrar} className="p-8 md:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tinta text-[18px] font-extrabold text-white">V</span>
            <span className="text-[15px] font-extrabold tracking-[-0.01em]">Vertion Leads</span>
          </div>
          <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">Entrar</h1>
          <p className="mt-2 text-[13.5px] font-medium text-zinc-500">Vertion Leads · comércios sem site próprio</p>

          <label htmlFor="nome" className="mb-2 mt-8 block text-[13px] font-bold">
            Seu nome
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder="lucas"
            className="min-h-[48px] w-full rounded-full bg-zinc-100 px-5 text-[14px] font-medium outline-none transition-colors placeholder:text-zinc-600 focus:bg-white focus:ring-2 focus:ring-roxo-200"
          />

          <label htmlFor="senha" className="mb-2 mt-5 block text-[13px] font-bold">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="min-h-[48px] w-full rounded-full bg-zinc-100 px-5 text-[14px] font-medium outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-roxo-200"
          />

          {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}

          <button
            type="submit"
            disabled={enviando || !senha}
            className="mt-7 min-h-[48px] w-full rounded-full bg-tinta text-[14px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
