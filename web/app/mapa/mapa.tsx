'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapaLeaflet, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame, MapPin, Snowflake, Sun } from 'lucide-react';
import FichaLead from '../ficha-lead';

/**
 * O mapa dos leads: um ponto por comércio, na cor da temperatura. Mapa do
 * OpenStreetMap (grátis, com o crédito exigido no canto). Clicar no ponto
 * mostra o nome; "Abrir ficha" abre a mesma ficha do painel.
 */

type Nivel = 'quente' | 'morno' | 'frio';

interface Ponto {
  id: string;
  nome: string;
  categoria: string | null;
  endereco: string | null;
  lat: number;
  lng: number;
  status: string;
  nivel: Nivel;
  telefone: string | null;
}

// as cores fortes da temperatura: o pastel do painel some sobre o mapa
const COR: Record<Nivel, { borda: string; fundo: string; rotulo: string; Icone: typeof Flame; chip: string }> = {
  quente: { borda: '#b91c1c', fundo: '#ef4444', rotulo: 'Quentes', Icone: Flame, chip: 'bg-rosa text-red-900' },
  morno: { borda: '#b45309', fundo: '#f59e0b', rotulo: 'Mornos', Icone: Sun, chip: 'bg-manteiga text-amber-900' },
  frio: { borda: '#5b21b6', fundo: '#8b5cf6', rotulo: 'Frios', Icone: Snowflake, chip: 'bg-lavanda text-roxo-900' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function MapaDosLeads() {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [niveis, setNiveis] = useState<Set<Nivel>>(new Set(['quente', 'morno', 'frio']));
  const [esconderFechados, setEsconderFechados] = useState(true);
  const [ficha, setFicha] = useState<string | null>(null);

  async function carregar() {
    try {
      const j = await (await fetch('/api/leads/mapa', { cache: 'no-store' })).json();
      if (!j.ok) throw new Error(j.erro);
      setPontos(j.pontos);
    } catch {
      setErro('Não consegui carregar o mapa. Recarregue a página.');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const visiveis = useMemo(
    () => (pontos || []).filter((p) => niveis.has(p.nivel) && (!esconderFechados || !['fechado', 'descartado'].includes(p.status))),
    [pontos, niveis, esconderFechados],
  );

  // cria o mapa uma vez (o Leaflet mexe na página, então só no navegador)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !caixa.current || mapa.current) return;
      const m = L.map(caixa.current, { zoomControl: true, attributionControl: true }).setView([-14.2, -51.9], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);
      mapa.current = m;
      camada.current = L.layerGroup().addTo(m);
      // o botão dentro do balão abre a ficha do lead
      m.on('popupopen', (e) => {
        const botao = e.popup.getElement()?.querySelector<HTMLButtonElement>('[data-ficha]');
        botao?.addEventListener('click', () => setFicha(botao.dataset.ficha || null), { once: true });
      });
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // redesenha os pontos quando muda o filtro
  useEffect(() => {
    (async () => {
      const L = (await import('leaflet')).default;
      const m = mapa.current;
      const c = camada.current;
      if (!m || !c || !pontos) return;
      c.clearLayers();
      for (const p of visiveis) {
        const cor = COR[p.nivel];
        L.circleMarker([p.lat, p.lng], { radius: 8, color: cor.borda, weight: 2, fillColor: cor.fundo, fillOpacity: 0.9 })
          .bindPopup(
            `<div style="font-family:var(--font-manrope),system-ui,sans-serif;min-width:180px">
              <strong style="font-size:14px">${esc(p.nome)}</strong>
              <div style="font-size:12px;color:#52525b;margin-top:2px">${esc([p.categoria, cor.rotulo.slice(0, -1)].filter(Boolean).join(' · '))}</div>
              ${p.endereco ? `<div style="font-size:12px;color:#71717a;margin-top:4px">${esc(p.endereco)}</div>` : ''}
              <button data-ficha="${esc(p.id)}" style="margin-top:10px;background:#0b0b0f;color:#fff;border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer">Abrir ficha</button>
            </div>`,
          )
          .addTo(c);
      }
      if (visiveis.length) {
        m.fitBounds(L.latLngBounds(visiveis.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
      }
    })();
  }, [visiveis, pontos]);

  const contagem = (n: Nivel) => (pontos || []).filter((p) => p.nivel === n && (!esconderFechados || !['fechado', 'descartado'].includes(p.status))).length;

  return (
    <div className="mt-6 flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(COR) as Nivel[]).map((n) => {
          const c = COR[n];
          const ligado = niveis.has(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={ligado}
              onClick={() => setNiveis((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; })}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-opacity ${c.chip} ${ligado ? '' : 'opacity-40'}`}
            >
              <c.Icone aria-hidden className="h-4 w-4" />
              {c.rotulo} <span className="tabular-nums opacity-70">{contagem(n)}</span>
            </button>
          );
        })}
        <label className="ml-1 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100">
          <input type="checkbox" checked={esconderFechados} onChange={(e) => setEsconderFechados(e.target.checked)} className="h-4 w-4 accent-[#0b0b0f]" />
          Esconder fechados e descartados
        </label>
      </div>

      <div className="relative mt-4 h-[calc(100vh-250px)] min-h-[420px] overflow-hidden rounded-[24px] ring-1 ring-zinc-200">
        <div ref={caixa} className="absolute inset-0 z-0" aria-label="Mapa dos leads" />
        {pontos && !visiveis.length && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6">
            <p className="pointer-events-auto max-w-sm rounded-2xl bg-white px-5 py-4 text-center text-[13.5px] font-semibold shadow-[0_12px_32px_rgba(11,11,15,0.14)]">
              <MapPin aria-hidden className="mx-auto mb-2 h-5 w-5" />
              {pontos.length
                ? 'Nenhum lead com esses filtros.'
                : 'Nenhum lead com localização ainda. Os comércios que vêm da busca do Google aparecem aqui sozinhos.'}
            </p>
          </div>
        )}
        {erro && <p role="alert" className="absolute left-4 top-4 z-[500] rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-red-700 shadow">{erro}</p>}
      </div>

      {ficha && <FichaLead key={ficha} leadId={ficha} abaInicial="whatsapp" aoFechar={() => setFicha(null)} aoMudar={carregar} />}
    </div>
  );
}
