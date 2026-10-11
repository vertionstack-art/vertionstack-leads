'use client';

import { useEffect, useState } from 'react';
import { Check, Share, Smartphone, X } from 'lucide-react';

type Convite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Instalar no celular": no Android/Chrome usa o convite do próprio
 * navegador; no iPhone (que não tem convite) mostra o caminho pelo Safari.
 */
export default function InstalarApp({ aoFechar }: { aoFechar: () => void }) {
  const [tipo, setTipo] = useState<'instalado' | 'convite' | 'iphone' | 'android' | 'computador'>('computador');
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    const convite = (window as unknown as { convidarInstalacao?: Convite }).convidarInstalacao;
    setTipo(instalado ? 'instalado' : convite ? 'convite' : /iphone|ipad|ipod/i.test(ua) ? 'iphone' : /android/i.test(ua) ? 'android' : 'computador');
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  async function instalar() {
    const convite = (window as unknown as { convidarInstalacao?: Convite }).convidarInstalacao;
    if (!convite) return;
    await convite.prompt();
    const r = await convite.userChoice;
    if (r.outcome === 'accepted') setFeito(true);
  }

  const passo = (n: number, texto: React.ReactNode) => (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta text-[13px] font-extrabold text-white">{n}</span>
      <span className="pt-0.5 text-[14px] leading-relaxed">{texto}</span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instalar no celular"
        className="w-full max-w-md rounded-t-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(11,11,15,0.25)] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 text-[18px] font-extrabold tracking-[-0.02em]">
            <Smartphone aria-hidden className="h-5 w-5" /> Instalar no celular
          </h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-tinta">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-[13.5px] text-zinc-600">
          A ferramenta vira um ícone na tela do seu celular e abre direto no painel, sem barra do navegador. Não precisa de loja de aplicativos.
        </p>

        <div className="mt-5">
          {tipo === 'instalado' || feito ? (
            <p className="flex items-center gap-2 rounded-2xl bg-menta px-4 py-3 text-[14px] font-semibold text-emerald-950">
              <Check aria-hidden className="h-4 w-4" /> Pronto, o Vertion Leads está instalado neste aparelho.
            </p>
          ) : tipo === 'convite' ? (
            <button type="button" onClick={instalar} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-tinta px-6 text-[14px] font-bold text-white hover:bg-tinta-70">
              <Smartphone aria-hidden className="h-4 w-4" /> Instalar agora
            </button>
          ) : tipo === 'iphone' ? (
            <ol className="space-y-3">
              {passo(1, <>Abra esta página no <b>Safari</b> (no Chrome do iPhone não aparece a opção).</>)}
              {passo(2, <>Toque no botão <b>Compartilhar</b> <Share aria-hidden className="inline h-4 w-4 align-[-2px]" /> na barra de baixo.</>)}
              {passo(3, <>Role e toque em <b>Adicionar à Tela de Início</b>, depois em <b>Adicionar</b>.</>)}
            </ol>
          ) : tipo === 'android' ? (
            <ol className="space-y-3">
              {passo(1, <>No Chrome, toque nos <b>três pontinhos</b> ⋮ no canto de cima.</>)}
              {passo(2, <>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</>)}
              {passo(3, <>Confirme em <b>Instalar</b>. O ícone aparece junto dos seus aplicativos.</>)}
            </ol>
          ) : (
            <ol className="space-y-3">
              {passo(1, <>Abra <b>leads.vertionstack.com</b> no navegador do celular e entre na sua conta.</>)}
              {passo(2, <>Toque em <b>Instalar no celular</b> no menu do seu nome e siga o passo a passo.</>)}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
