'use client';

import { useEffect, useState } from 'react';
import { Moldura, botao, campo, postar, rotulo } from '../../moldura-auth';

type Etapa = 'carregando' | 'cadastrar' | 'ler-qr' | 'codigo';

export default function DoisFatores() {
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [qr, setQr] = useState('');
  const [segredo, setSegredo] = useState('');
  const [fator, setFator] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch('/api/auth/2fa', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return window.location.assign('/');
        if (d.confirmado) return window.location.assign('/admin');
        setEtapa(d.ligado ? 'codigo' : 'cadastrar');
      })
      .catch(() => setErro('Sem conexão. Recarregue a página.'));
  }, []);

  async function gerarQr() {
    setEnviando(true);
    setErro(null);
    const r = (await postar('/api/auth/2fa', { acao: 'cadastrar' })) as { ok: boolean; erro?: string; qr?: string; segredo?: string; fator?: string };
    setEnviando(false);
    if (!r.ok || !r.qr) return setErro(r.erro || 'Não consegui gerar o QR Code.');
    setQr(r.qr);
    setSegredo(r.segredo || '');
    setFator(r.fator || '');
    setEtapa('ler-qr');
  }

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await postar('/api/auth/2fa', etapa === 'ler-qr' ? { acao: 'confirmar', fator, codigo } : { acao: 'verificar', codigo });
    if (r.ok) window.location.assign('/admin');
    else {
      setErro(r.erro || 'Código não confere.');
      setEnviando(false);
      setCodigo('');
    }
  }

  const formCodigo = (
    <form onSubmit={enviarCodigo} noValidate>
      <label htmlFor="codigo" className={rotulo}>Código de 6 números</label>
      <input
        id="codigo"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        className={`${campo} text-center text-[20px] tracking-[0.4em] tabular-nums`}
      />
      {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
      <button type="submit" disabled={enviando || codigo.length !== 6} className={botao}>
        {enviando ? 'Conferindo…' : 'Entrar na administração'}
      </button>
    </form>
  );

  if (etapa === 'carregando') {
    return <Moldura titulo="Administração" subtitulo="Conferindo a sua conta…"><div className="mt-8 h-24 animate-pulse rounded-2xl bg-zinc-100" /></Moldura>;
  }

  if (etapa === 'cadastrar') {
    return (
      <Moldura titulo="Proteja a administração" subtitulo="Uma vez só: ligue o código do Google Authenticator.">
        <ol className="mt-7 space-y-3 text-[14px] leading-relaxed text-zinc-700">
          <li><b>1.</b> Instale o <b>Google Authenticator</b> no celular (App Store ou Play Store).</li>
          <li><b>2.</b> Clique no botão abaixo para gerar o QR Code.</li>
          <li><b>3.</b> No app, toque em <b>+</b> e em <b>Ler QR Code</b>.</li>
        </ol>
        {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
        <button onClick={gerarQr} disabled={enviando} className={botao}>
          {enviando ? 'Gerando…' : 'Gerar QR Code'}
        </button>
      </Moldura>
    );
  }

  if (etapa === 'ler-qr') {
    return (
      <Moldura titulo="Leia o QR Code" subtitulo="Com o Google Authenticator, e digite o número que aparecer.">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code para o Google Authenticator" className="mx-auto mt-6 h-48 w-48 rounded-2xl bg-white p-2 ring-1 ring-zinc-200" />
        <details className="mt-3 text-center text-[12.5px] text-zinc-600">
          <summary className="cursor-pointer font-semibold">Não consigo ler o QR Code</summary>
          <p className="mt-2">No app, escolha <b>Inserir chave de configuração</b> e digite:</p>
          <code className="mt-1 block break-all rounded-xl bg-zinc-100 px-3 py-2 text-[13px] font-semibold text-tinta">{segredo}</code>
        </details>
        {formCodigo}
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Código de acesso" subtitulo="Abra o Google Authenticator e digite o número da Vertion Leads.">
      {formCodigo}
    </Moldura>
  );
}
