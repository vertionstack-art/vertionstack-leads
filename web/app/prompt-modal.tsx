'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lead } from '@/lib/db';
import { montarPrompt } from '@/lib/prompt-lead';
import { montarPromptSite } from '@/lib/prompt-site';
import { montarPromptGringa } from '@/lib/prompt-gringa';

export type Variante = 'abordagem' | 'site' | 'gringa';

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
  gringa: {
    titulo: 'Prompt do e-mail — lead de fora do Brasil',
    subtitulo:
      'Cole na SkynetChat com a opção Persuasão ligada. Volta com três assuntos, o e-mail pronto e dois follow-ups, no idioma do país.',
    destino: 'Abrir SkynetChat',
    url: 'https://skynetchat.net/',
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
  /*
   * O preço em dólar fica no navegador, não no banco.
   *
   * É um número de negociação que muda entre uma tentativa e outra, e não
   * tem nada a ver com a proposta em real que o lead brasileiro recebe.
   * Guardar aqui evita redigitar ao reabrir a janela, sem inventar coluna
   * nova nem misturar duas moedas no mesmo campo.
   */
  const [precoUsd, setPrecoUsd] = useState('');
  const [guardandoPrevia, setGuardandoPrevia] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  /*
   * O prompt é montado com a prévia já salva no lead. Enquanto o campo não
   * for gravado, o texto continua sendo o de quem não tem prévia — e é
   * melhor assim: prometer um link que não existe estraga a abordagem.
   */
  const chavePreco = `vl:preco-usd:${lead.id}`;

  useEffect(() => {
    if (variante !== 'gringa') return;
    try {
      setPrecoUsd(localStorage.getItem(chavePreco) || '');
    } catch {
      // navegador que bloqueia armazenamento: começa vazio e segue funcionando
    }
  }, [chavePreco, variante]);

  function mudarPreco(valor: string) {
    setPrecoUsd(valor);
    try {
      if (valor.trim()) localStorage.setItem(chavePreco, valor);
      else localStorage.removeItem(chavePreco);
    } catch {
      // sem armazenamento o valor ainda vale para esta janela
    }
  }

  const precoNumero = Number(precoUsd.replace(/[^\d]/g, ''));

  const prompt =
    variante === 'site'
      ? montarPromptSite(lead)
      : variante === 'gringa'
        ? montarPromptGringa(
            { ...lead, previaUrl: lead.previaUrl },
            { precoUsd: precoNumero > 0 ? precoNumero : null },
          )
        : montarPrompt({ ...lead, previaUrl: lead.previaUrl });

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
                ? variante === 'gringa'
                  ? 'O e-mail vai girar em torno desta prévia: site pronto, com o nome dele, antes de ele responder qualquer coisa.'
                  : 'O prompt abaixo já usa esta prévia como centro da abordagem.'
                : variante === 'gringa'
                  ? 'Sem prévia o e-mail fica bem mais fraco. Publique na Vercel, cole aqui e salve antes de gerar.'
                  : 'Publique a prévia na Vercel, cole aqui e salve — o prompt muda para girar em torno dela.'}
          </p>
        </div>

        {/* ------------------------------------------ preço em dólar */}
        {variante === 'gringa' && (
          <div className="border-b border-zinc-200 bg-sky-50 px-6 py-3.5">
            <label
              htmlFor="preco-usd"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-sky-800"
            >
              Quanto você vai cobrar pelo site
            </label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-sky-700">
                  $
                </span>
                <input
                  id="preco-usd"
                  type="text"
                  inputMode="numeric"
                  value={precoUsd}
                  onChange={(e) => mudarPreco(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="1200"
                  className="min-h-[40px] w-36 rounded-lg border border-sky-200 bg-white pl-7 pr-3 text-[13px] tabular-nums outline-none focus:border-sky-500"
                />
              </div>
              {precoNumero > 0 && (
                <span className="text-[12.5px] text-sky-900">
                  USD {precoNumero.toLocaleString('en-US')} — vai escrito no e-mail
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-sky-900/70">
              {precoNumero > 0
                ? 'O e-mail cita este número uma vez, depois do link da demo — preço antes do valor vira só custo.'
                : 'Deixe vazio para não falar de preço neste e-mail. A IA não vai inventar nem dar faixa de valor.'}
            </p>
          </div>
        )}

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
