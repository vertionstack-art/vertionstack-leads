'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Moldura, botao, campo, postar, rotulo } from '../moldura-auth';

export default function Esqueci() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await postar('/api/auth/esqueci', { email });
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setErro(r.erro || 'Não consegui mandar agora.');
  }

  if (enviado) {
    return (
      <Moldura titulo="Confira seu e-mail" subtitulo="Se existir uma conta com esse e-mail, o link já está a caminho.">
        <p className="mt-8 text-[14px] leading-relaxed text-zinc-600">
          Clique no link do e-mail para escolher uma senha nova. Ele vale por pouco tempo; se expirar, peça outro aqui.
        </p>
        <Link href="/login" className={`${botao} flex items-center justify-center`}>Voltar para entrar</Link>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Esqueci a senha" subtitulo="Mandamos um link para você escolher outra.">
      <form onSubmit={pedir} noValidate>
        <label htmlFor="email" className={rotulo}>E-mail da conta</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" className={campo} />
        {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
        <button type="submit" disabled={enviando || !email} className={botao}>
          {enviando ? 'Mandando…' : 'Mandar link'}
        </button>
        <p className="mt-5 text-center text-[13px] font-semibold">
          <Link href="/login" className="text-zinc-600 underline underline-offset-2 hover:text-tinta">Lembrei, quero entrar</Link>
        </p>
      </form>
    </Moldura>
  );
}
