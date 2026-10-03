'use client';

import { useState } from 'react';
import { Moldura, botao, campo, postar, rotulo } from '../moldura-auth';

export default function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    if (senha !== repetida) return setErro('As duas senhas não são iguais.');
    setEnviando(true);
    setErro(null);
    const r = await postar('/api/auth/nova-senha', { senha });
    if (r.ok) window.location.assign('/');
    else {
      setErro(r.erro || 'Não consegui trocar a senha.');
      setEnviando(false);
    }
  }

  return (
    <Moldura titulo="Senha nova" subtitulo="Escolha uma senha que você não usa em outro lugar.">
      <form onSubmit={salvar} noValidate>
        <label htmlFor="senha" className={rotulo}>Senha nova</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus autoComplete="new-password" maxLength={72} className={campo} />
        <label htmlFor="repetida" className={rotulo}>Repita a senha</label>
        <input id="repetida" type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" maxLength={72} className={campo} />
        {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
        <button type="submit" disabled={enviando || !senha || !repetida} className={botao}>
          {enviando ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>
    </Moldura>
  );
}
