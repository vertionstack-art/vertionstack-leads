'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

interface Teste {
  ia: string;
  ok: boolean;
  detalhe: string;
  ms: number;
}

/**
 * "Testar as IAs": manda um pedido mínimo para cada IA configurada na Vercel
 * e mostra quem respondeu, sem mostrar chave nenhuma.
 */
export default function TestarIas() {
  const [testando, setTestando] = useState(false);
  const [resultados, setResultados] = useState<Teste[] | null>(null);
  const [faltando, setFaltando] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function testar() {
    setTestando(true);
    setErro(null);
    try {
      const j = await fetch('/api/robo/ias', { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then((r) => r.json());
      if (!j.ok) throw new Error(j.erro || 'Não deu para testar agora.');
      setResultados(j.resultados);
      setFaltando(j.faltando || []);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setTestando(false);
    }
  }

  return (
    <section aria-labelledby="t-ias" className="mt-8 rounded-[24px] bg-zinc-50 p-5 ring-1 ring-inset ring-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="t-ias" className="flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em]">
            <Activity aria-hidden className="h-4 w-4" /> IAs do robô e do copiloto
          </h2>
          <p className="mt-1 max-w-[70ch] text-[12.5px] leading-snug text-zinc-600">
            Primeiro o Groq (dois modelos grátis); se os dois estiverem no limite, o Gemini entra de reserva. A IA do seu PC ficou de fora porque a placa de vídeo travou com ela.
          </p>
        </div>
        <button
          type="button"
          onClick={testar}
          disabled={testando}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white hover:bg-tinta-70 disabled:opacity-60"
        >
          {testando ? 'Testando…' : 'Testar as IAs'}
        </button>
      </div>
      {erro && <p role="alert" className="mt-3 text-[12.5px] font-semibold text-red-700">{erro}</p>}
      {resultados && (
        <ul className="mt-3 space-y-1.5">
          {resultados.map((r) => (
            <li key={r.ia} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-white px-3 py-2 text-[12.5px]">
              {r.ok ? <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-700" /> : <XCircle aria-hidden className="h-4 w-4 text-red-700" />}
              <span className="font-bold">{r.ia}</span>
              <span className={r.ok ? 'text-zinc-600' : 'font-semibold text-red-800'}>{r.ok ? `respondeu em ${(r.ms / 1000).toFixed(1).replace('.', ',')} s` : r.detalhe}</span>
            </li>
          ))}
          {faltando.map((v) => (
            <li key={v} className="rounded-[14px] bg-manteiga px-3 py-2 text-[12.5px] font-semibold text-amber-950">Não configurada na Vercel: {v}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
