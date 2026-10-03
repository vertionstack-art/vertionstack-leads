'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Moldura, botao, campo, postar, rotulo } from '../moldura-auth';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    setEnviando(true);
    setErro(null);
    const r = await postar('/api/auth/cadastrar', { nome, email, senha });
    if (!r.ok) {
      setErro(r.erro || 'Não consegui criar a conta.');
      setEnviando(false);
      return;
    }
    if (r.confirmar) setConfirmar(true);
    else window.location.assign('/');
  }

  if (confirmar) {
    return (
      <Moldura titulo="Confira seu e-mail" subtitulo={<>Mandamos um link para <b className="text-tinta">{email}</b>.</>}>
        <p className="mt-8 text-[14px] leading-relaxed text-zinc-600">
          Abra o e-mail e clique em confirmar. Depois disso você entra direto no painel. Se não chegar em alguns
          minutos, olhe a caixa de spam.
        </p>
        <Link href="/login" className={`${botao} flex items-center justify-center`}>Já confirmei, entrar</Link>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Criar conta" subtitulo="Grátis, com 10 leads novos por semana. Sem cartão.">
      <form onSubmit={criar} noValidate>
        <label htmlFor="nome" className={rotulo}>Como podemos te chamar</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus autoComplete="given-name" maxLength={60} className={campo} />

        <label htmlFor="email" className={rotulo}>E-mail</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={campo} />

        <label htmlFor="senha" className={rotulo}>Senha</label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          aria-describedby="senha-dica"
          maxLength={72}
          className={campo}
        />
        <p id="senha-dica" className="mt-2 text-[12px] text-zinc-500">Pelo menos 8 caracteres.</p>

        {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}

        <button type="submit" disabled={enviando || !nome || !email || !senha} className={botao}>
          {enviando ? 'Criando…' : 'Criar conta grátis'}
        </button>

        <p className="mt-5 text-center text-[13px] font-semibold text-zinc-600">
          Já tem conta?{' '}
          <Link href="/login" className="text-roxo-700 underline underline-offset-2 hover:text-roxo-800">Entrar</Link>
        </p>
      </form>
    </Moldura>
  );
}
