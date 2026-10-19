'use client';

import { useState } from 'react';
import { Briefcase, Check, Globe, Megaphone, Palette, Pencil, Share2, Sparkles } from 'lucide-react';
import { OFERTAS, PUBLICOS, infoOferta, type Oferta } from '@/lib/ofertas';

/**
 * "O que você vende?": o primeiro passo da busca. A escolha fica na conta
 * (lib/ofertas) e muda quais comércios entram como lead, a temperatura e a
 * primeira mensagem. Os públicos marcados viram nichos na busca (o
 * formulário de baixo escuta o evento "vl:nichos").
 */

const ICONE: Record<Oferta, typeof Globe> = {
  sites: Globe,
  social: Share2,
  trafego: Megaphone,
  design: Palette,
  empresas: Briefcase,
  outro: Sparkles,
};

export interface OfertaInicial {
  oferta: Oferta;
  texto: string;
  publico: string[];
  negocio: string;
  /** a conta nunca escolheu: o passo começa aberto */
  nova: boolean;
}

export default function EscolhaOferta({ inicial }: { inicial: OfertaInicial }) {
  const [aberto, setAberto] = useState(inicial.nova);
  const [oferta, setOferta] = useState<Oferta>(inicial.oferta);
  const [texto, setTexto] = useState(inicial.texto);
  const [publico, setPublico] = useState<Set<string>>(new Set(inicial.publico));
  const [negocio, setNegocio] = useState(inicial.negocio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const info = infoOferta(oferta);

  function escolher(o: Oferta) {
    setOferta(o);
    setErro(null);
    // público sugerido para quem ainda não marcou nenhum
    if (!publico.size) setPublico(new Set(infoOferta(o).publico));
  }

  async function salvar() {
    if (oferta === 'outro' && texto.trim().length < 4) return setErro('Conte em uma frase o que você vende.');
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/conta/oferta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oferta, texto, publico: [...publico], negocio }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro);
      const nichos = PUBLICOS.filter((p) => publico.has(p.id)).flatMap((p) => p.nichos);
      if (nichos.length) window.dispatchEvent(new CustomEvent('vl:nichos', { detail: nichos }));
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    const Icone = ICONE[oferta];
    return (
      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-ceu px-5 py-4">
        <p className="flex min-w-0 items-center gap-3 text-[14px]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-tinta text-white">
            <Icone aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-extrabold">Você vende: {oferta === 'outro' && texto ? texto : info.titulo}</span>
            <span className="block text-[12.5px] text-tinta/70">{info.criterio}</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold hover:bg-tinta hover:text-white"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" /> Trocar
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="t-oferta" className="mt-8 rounded-[24px] border border-zinc-200 p-6">
      <h2 id="t-oferta" className="text-[19px] font-extrabold tracking-[-0.02em]">O que você vende?</h2>
      <p className="mt-1 text-[13px] text-zinc-600">
        A ferramenta escolhe os comércios, a temperatura e a primeira mensagem pelo seu serviço.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OFERTAS.map((o) => {
          const Icone = ICONE[o.id];
          const sel = oferta === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={sel}
              onClick={() => escolher(o.id)}
              className={`flex items-start gap-3 rounded-[20px] p-4 text-left transition-colors ${
                sel ? 'bg-lavanda ring-2 ring-tinta' : 'bg-white ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-400'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${sel ? 'bg-tinta text-white' : 'bg-white text-tinta ring-1 ring-inset ring-zinc-200'}`}>
                <Icone aria-hidden className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold">{o.titulo}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-zinc-600">{o.descricao}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl bg-ceu px-4 py-3 text-[13px] leading-relaxed">
        <b>Quem entra como lead:</b> {info.criterio}
      </p>

      {oferta === 'outro' && (
        <label className="mt-5 block">
          <span className="text-[13px] font-bold">O que você vende? Em uma frase</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 120))}
            placeholder="Ex.: sistema de agendamento para salões"
            className="mt-1.5 min-h-[44px] w-full rounded-full bg-zinc-100 px-4 text-[14px] outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-roxo-200"
          />
        </label>
      )}

      <fieldset className="mt-5">
        <legend className="text-[13px] font-bold">Para quem você vende? Toque nos que servem</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PUBLICOS.map((p) => {
            const on = publico.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPublico((s) => { const x = new Set(s); if (x.has(p.id)) x.delete(p.id); else x.add(p.id); return x; })}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition-colors ${
                  on ? 'bg-tinta text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {on && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />}
                {p.rotulo}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-zinc-500">Os tipos de comércio de cada público já entram marcados na busca.</p>
      </fieldset>

      <label className="mt-5 block max-w-md">
        <span className="text-[13px] font-bold">Nome do seu negócio <span className="font-medium text-zinc-500">· vai na mensagem do WhatsApp</span></span>
        <input
          value={negocio}
          onChange={(e) => setNegocio(e.target.value.slice(0, 80))}
          placeholder="Ex.: Estúdio Rafa Sites"
          className="mt-1.5 min-h-[44px] w-full rounded-full bg-zinc-100 px-4 text-[14px] outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-roxo-200"
        />
      </label>

      {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={salvando}
          onClick={salvar}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-tinta px-6 text-[13.5px] font-bold text-white hover:bg-tinta-70 disabled:bg-zinc-300"
        >
          <Check aria-hidden className="h-4 w-4" />
          {salvando ? 'Salvando…' : 'Pronto, escolher onde buscar'}
        </button>
        {!inicial.nova && (
          <button type="button" onClick={() => setAberto(false)} className="text-[13px] font-bold text-zinc-500 hover:text-tinta">
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
