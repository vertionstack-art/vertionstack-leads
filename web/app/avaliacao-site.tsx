'use client';

import { useState } from 'react';
import { ExternalLink, Gauge, Loader2, Sparkles } from 'lucide-react';
import type { AvaliacaoSite } from '@/lib/nota-site';

/**
 * A nota do site na ficha do lead: os problemas medidos pela busca e, no seu
 * clique, um resumo da IA feito só com o que foi medido.
 */
export default function AvaliacaoDoSite({
  leadId,
  website,
  inicial,
  aoMudar,
}: {
  leadId: string;
  website: string;
  inicial: AvaliacaoSite | null;
  aoMudar?: () => void;
}) {
  const [av, setAv] = useState<AvaliacaoSite | null>(inicial);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function avaliar() {
    setCarregando(true);
    setAviso(null);
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(leadId)}/avaliar-site`, { method: 'POST' });
      const j = await r.json().catch(() => ({ ok: false }));
      if (!j.ok) throw new Error(j.erro || 'Não consegui avaliar agora. Tente de novo.');
      setAv(j.avaliacao);
      if (j.aviso) setAviso(j.aviso);
      aoMudar?.();
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const fraco = av ? av.nota <= 6 : false;

  return (
    <section className={`mb-4 rounded-[20px] px-4 py-3.5 ${fraco ? 'bg-ceu' : 'bg-zinc-100'}`} aria-label="Avaliação do site">
      <div className="flex flex-wrap items-center gap-2">
        <Gauge aria-hidden className="h-4 w-4 shrink-0" />
        <span className="text-[13.5px] font-extrabold">
          {av ? `Site: nota ${String(av.nota).replace('.', ',')} de 10` : 'Site no ar, ainda sem nota'}
        </span>
        <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-600 underline underline-offset-2 hover:text-tinta">
          abrir <ExternalLink aria-hidden className="h-3 w-3" />
        </a>
      </div>

      {av && (
        <>
          <p className="mt-1 text-[12px] font-semibold text-zinc-600">
            {av.velocidade !== null
              ? `Velocidade no celular (teste do Google): ${av.velocidade} de 100${av.carregaEmS ? ` · ${String(av.carregaEmS).replace('.', ',')} s para aparecer` : ''}`
              : 'Velocidade no celular: não deu para medir'}
          </p>
          {av.problemas.length > 0 ? (
            <ul className="mt-2 grid gap-1">
              {av.problemas.map((p) => (
                <li key={p.codigo} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-zinc-800">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-tinta" /> {p.texto}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-zinc-700">Nenhum problema achado pelas regras da ferramenta.</p>
          )}
          {av.ia && (
            <div className="mt-3 rounded-[14px] bg-white/80 px-3 py-2.5">
              <p className="text-[11.5px] font-extrabold uppercase tracking-wide text-zinc-500">Avaliação da IA</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-800">{av.ia.resumo}</p>
              {av.ia.pontos.length > 0 && (
                <ul className="mt-1.5 grid gap-1">
                  {av.ia.pontos.map((p) => (
                    <li key={p} className="text-[12.5px] leading-snug text-zinc-800">• {p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={avaliar}
          disabled={carregando}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-tinta px-3.5 text-[12.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:opacity-50"
        >
          {carregando ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Sparkles aria-hidden className="h-3.5 w-3.5" />}
          {carregando ? 'Avaliando…' : av?.ia ? 'Avaliar de novo com IA' : 'Avaliar site com IA'}
        </button>
        <span className="text-[11.5px] text-zinc-600">Usa só o que foi medido. Visitas do site não entram: só o dono vê esse número.</span>
      </div>
      {aviso && <p role="status" className="mt-2 text-[12px] font-semibold text-amber-900">{aviso}</p>}
    </section>
  );
}
