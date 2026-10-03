'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Moldura, botao, campo, postar, rotulo } from '../moldura-auth';

const ERROS_DO_LINK: Record<string, string> = {
  link: 'Esse link expirou ou já foi usado. Entre com sua senha ou peça um novo.',
  google: 'O login com Google não funcionou agora. Tente com e-mail e senha.',
};

function Formulario() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(ERROS_DO_LINK[params.get('erro') || ''] || null);
  const [enviando, setEnviando] = useState(false);
  const comGoogle = process.env.NEXT_PUBLIC_LOGIN_GOOGLE === '1';

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await postar('/api/auth/entrar', { email, senha });
    if (r.ok) {
      // navegação do próprio navegador, não router.push: a rota "/" é um
      // server component que já foi buscado uma vez sem a sessão
      window.location.assign('/');
    } else {
      setErro(r.erro || 'Não consegui entrar.');
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} noValidate>
      {comGoogle && (
        <>
          <a
            href="/api/auth/google"
            className="mt-8 flex min-h-[48px] w-full items-center justify-center rounded-full border border-zinc-200 text-[14px] font-bold transition-colors hover:border-zinc-400"
          >
            Entrar com Google
          </a>
          <p className="mt-5 text-center text-[12px] font-semibold text-zinc-500">ou com e-mail</p>
        </>
      )}

      <label htmlFor="email" className={rotulo}>E-mail</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" className={campo} />

      <label htmlFor="senha" className={rotulo}>Senha</label>
      <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" className={campo} />

      {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}

      <button type="submit" disabled={enviando || !email || !senha} className={botao}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>

      <div className="mt-5 flex flex-wrap justify-between gap-2 text-[13px] font-semibold">
        <Link href="/esqueci" className="text-zinc-600 underline underline-offset-2 hover:text-tinta">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-roxo-700 underline underline-offset-2 hover:text-roxo-800">Criar conta grátis</Link>
      </div>
    </form>
  );
}

export default function Login() {
  return (
    <Moldura titulo="Entrar" subtitulo="Vertion Leads · comércios sem site próprio">
      <Suspense>
        <Formulario />
      </Suspense>
    </Moldura>
  );
}
