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
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-roxo-600 ring-4 ring-roxo-100" />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Vertion Leads</h1>
            <p className="text-[11px] leading-tight text-zinc-500">comércios sem site próprio</p>
          </div>
        </div>

        <label htmlFor="nome" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
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
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-[14px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
        />

        <label htmlFor="senha" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-[14px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
        />

        {erro && <p className="mt-2.5 text-[12.5px] text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={enviando || !senha}
          className="mt-5 w-full rounded-lg bg-roxo-600 py-2.5 text-[14px] font-semibold text-white transition hover:bg-roxo-700 disabled:bg-zinc-300"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
