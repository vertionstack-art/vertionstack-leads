'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lead } from '@/lib/db';
import { montarPrompt } from '@/lib/prompt-lead';
import { montarPromptSite } from '@/lib/prompt-site';

export type Variante = 'abordagem' | 'site';

const TEXTOS: Record<Variante, { titulo: string; subtitulo: string; destino: string; url: string }> = {
  abordagem: {
    titulo: 'Prompt de abordagem',
    subtitulo:
      'Cole no ChatGPT para receber briefing, mensagens de WhatsApp, roteiro de ligação e respostas para objeções.',
    destino: 'Abrir chat',
    url: 'https://chatgpt.com/',
  },
  site: {
    titulo: 'Prompt para construir o site',
    subtitulo:
      'Cole no Claude Code. Ele instala as skills, monta o site com os dados deste comércio, sobe no GitHub e publica na Vercel.',
    destino: 'Abrir Claude',
    url: 'https://claude.ai/',
  },
};

/**
 * Mostra um prompt pronto de um lead para copiar.
 *
 * São dois usos no mesmo formato: o de abordagem, que vai para o chat e
 * volta como material de venda, e o de construção, que vai para o
 * assistente que escreve o código do site de prévia. O caminho entre ver
 * o lead e ter o texto na mão precisa ser curto — isso é feito dezenas de
 * vezes por dia.
 */
export default function PromptModal({
  lead,
  variante = 'abordagem',
  aoFechar,
  aoSalvarPrevia,
}: {
  lead: Lead;
  variante?: Variante;
  aoFechar: () => void;
  aoSalvarPrevia: (url: string) => Promise<void>;
}) {
  const t = TEXTOS[variante];
  const [copiado, setCopiado] = useState(false);
  const [previa, setPrevia] = useState(lead.previaUrl || '');
  const [guardandoPrevia, setGuardandoPrevia] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /*
   * O prompt é montado com a prévia já salva no lead. Enquanto o campo não
   * for gravado, o texto continua sendo o de quem não tem prévia — e é
   * melhor assim: prometer um link que não existe estraga a abordagem.
   */
  const prompt =
    variante === 'site' ? montarPromptSite(lead) : montarPrompt({ ...lead, previaUrl: lead.previaUrl });

  async function salvarPrevia() {
    setGuardandoPrevia(true);
    await aoSalvarPrevia(previa.trim());
    setGuardandoPrevia(false);
  }

  // Esc fecha, como em qualquer janela
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // navegador que bloqueia a área de transferência: seleciona para o Ctrl+C
      areaRef.current?.select();
      document.execCommand('copy');
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={aoFechar}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ------------------------------------------------------ topo */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">
              {t.titulo} — {lead.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">{t.subtitulo}</p>
          </div>
          <button
            onClick={aoFechar}
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* --------------------------------------------------- prévia */}
        <div className="border-b border-zinc-200 bg-roxo-50 px-6 py-3.5">
          <label htmlFor="previa" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-roxo-800">
            Site de prévia deste comércio
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="previa"
              value={previa}
              onChange={(e) => setPrevia(e.target.value)}
              placeholder="https://previa-barbearia.vercel.app"
              className="min-h-[40px] min-w-[240px] flex-1 rounded-lg border border-roxo-200 bg-white px-3 text-[13px] outline-none focus:border-roxo-500"
            />
            <button
              onClick={salvarPrevia}
              disabled={guardandoPrevia || previa.trim() === (lead.previaUrl || '')}
              className="min-h-[40px] rounded-lg bg-roxo-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-roxo-700 disabled:bg-zinc-300"
            >
              {guardandoPrevia ? 'Salvando…' : 'Salvar e refazer'}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-roxo-900/70">
            {variante === 'site'
              ? 'Quando o site estiver publicado, cole o endereço aqui — ele passa a ser usado na abordagem e na proposta.'
              : lead.previaUrl
                ? 'O prompt abaixo já usa esta prévia como centro da abordagem.'
                : 'Publique a prévia na Vercel, cole aqui e salve — o prompt muda para girar em torno dela.'}
          </p>
        </div>

        {/* ----------------------------------------------------- texto */}
        <div className="min-h-0 flex-1 overflow-auto bg-zinc-50 p-4">
          <textarea
            ref={areaRef}
            readOnly
            value={prompt}
            onFocus={(e) => e.currentTarget.select()}
            className="h-[52vh] w-full resize-none rounded-xl border border-zinc-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-zinc-800 outline-none focus:border-roxo-400"
          />
        </div>

        {/* ---------------------------------------------------- rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <p className="text-[12px] text-zinc-500">
            {copiado
              ? 'Copiado. Agora é só colar com Ctrl+V.'
              : `${prompt.length.toLocaleString('pt-BR')} caracteres — copie e cole.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={copiar}
              className={`rounded-lg px-5 py-2 text-[13px] font-semibold text-white transition ${
                copiado ? 'bg-emerald-600' : 'bg-roxo-600 hover:bg-roxo-700'
              }`}
            >
              {copiado ? '✓ Copiado!' : '1. Copiar prompt'}
            </button>
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (!copiado) copiar(); }}
              className={`rounded-lg px-5 py-2 text-[13px] font-semibold transition ${
                copiado
                  ? 'bg-tinta text-white hover:brightness-150'
                  : 'border border-zinc-300 text-zinc-700 hover:border-roxo-400 hover:text-roxo-700'
              }`}
            >
              2. {t.destino} ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
