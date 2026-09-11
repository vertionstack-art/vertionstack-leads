'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Acesso, ResumoPorIp } from '@/lib/acessos';

const ROTULO_RESULTADO: Record<string, { texto: string; classe: string }> = {
  ok: { texto: 'entrou', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  senha_errada: { texto: 'senha errada', classe: 'bg-red-50 text-red-700 ring-red-200' },
  bloqueado: { texto: 'barrado', classe: 'bg-zinc-800 text-white ring-zinc-800' },
  chave_errada: { texto: 'chave errada', classe: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

function quando(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "Mozilla/5.0 (Windows NT 10.0…) Chrome/126" vira "Chrome no Windows" */
function navegadorLegivel(ua: string | null): string {
  if (!ua) return '—';
  const sistema = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad/i.test(ua)
        ? 'iPhone'
        : /Mac OS/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const app = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : /curl/i.test(ua)
              ? 'curl'
              : 'outro';
  return [app, sistema].filter(Boolean).join(' no ');
}

export default function PainelAcessos({ meuIp }: { meuIp: string }) {
  const [ips, setIps] = useState<ResumoPorIp[]>([]);
  const [historico, setHistorico] = useState<Acesso[]>([]);
  const [ipAberto, setIpAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (ip?: string) => {
    setCarregando(true);
    try {
      const r = await fetch('/api/admin/acessos' + (ip ? `?ip=${encodeURIComponent(ip)}` : ''), {
        cache: 'no-store',
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'Falha ao carregar.');
      setIps(d.ips);
      setHistorico(d.historico);
      setErro(null);
    } catch (e) {
      setErro(String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarBloqueio(ip: string, bloqueado: boolean) {
    if (ip === meuIp && !bloqueado) {
      alert('Esse é o endereço que você está usando agora. Bloqueá-lo trancaria você do lado de fora.');
      return;
    }

    let motivo = '';
    if (!bloqueado) {
      const resposta = prompt(`Bloquear ${ip}. Por quê? (opcional, para você lembrar depois)`);
      if (resposta === null) return;
      motivo = resposta;
    }

    const r = await fetch('/api/admin/acessos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, motivo, acao: bloqueado ? 'liberar' : 'bloquear' }),
    });
    const d = await r.json();
    if (d.ok) setIps(d.ips);
    else setErro(d.erro);
  }

  const bloqueados = ips.filter((i) => i.bloqueado).length;
  const comFalha = ips.filter((i) => i.falhas > 0).length;

  return (
    <>
      {erro && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{erro}</div>
      )}

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
        <b>Bloquear por endereço segura pouco.</b> Internet de casa troca de endereço quando o
        roteador reinicia, operadora de celular põe várias pessoas atrás do mesmo número (bloquear
        um bloqueia todas), e qualquer VPN contorna. Use para cortar ruído e enxergar movimento
        estranho — quem protege o painel de verdade é a senha.
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: ips.length, r: 'endereços vistos' },
          { n: comFalha, r: 'com tentativa falha' },
          { n: bloqueados, r: 'bloqueados' },
          { n: historico.length, r: 'acessos recentes' },
        ].map((c) => (
          <div key={c.r} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{c.n}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{c.r}</div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------ por endereço */}
      <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-[14px] font-semibold">Quem acessou</h2>
          <p className="text-[12px] text-zinc-500">Um por endereço, do mais recente para o mais antigo.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Endereço</th>
                <th className="px-4 py-2.5 font-semibold">De onde</th>
                <th className="px-4 py-2.5 font-semibold">Quem entrou</th>
                <th className="px-4 py-2.5 text-center font-semibold">Acessos</th>
                <th className="px-4 py-2.5 text-center font-semibold">Falhas</th>
                <th className="px-4 py-2.5 font-semibold">Última vez</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ips.map((i) => (
                <tr key={i.ip} className={i.bloqueado ? 'bg-zinc-50' : ''}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setIpAberto(i.ip); carregar(i.ip); }}
                      className="font-medium tabular-nums text-roxo-700 hover:underline"
                    >
                      {i.ip}
                    </button>
                    {i.ip === meuIp && (
                      <span className="ml-2 rounded bg-roxo-100 px-1.5 py-0.5 text-[10px] font-medium text-roxo-800">
                        você
                      </span>
                    )}
                    {i.bloqueado && (
                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        bloqueado{i.motivo ? ` — ${i.motivo}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {[i.cidade, i.pais].filter(Boolean).join(', ') || '—'}
                    <div className="text-[11px] text-zinc-400">{navegadorLegivel(i.navegador)}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{i.usuarios.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{i.acessos}</td>
                  <td className={`px-4 py-3 text-center tabular-nums ${i.falhas > 0 ? 'font-semibold text-red-600' : 'text-zinc-400'}`}>
                    {i.falhas}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{quando(i.ultimo)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => alternarBloqueio(i.ip, i.bloqueado)}
                      className={`min-h-[36px] rounded-lg border px-3 text-[12px] font-medium transition ${
                        i.bloqueado
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500'
                          : 'border-zinc-300 text-zinc-600 hover:border-red-400 hover:text-red-700'
                      }`}
                    >
                      {i.bloqueado ? 'Liberar' : 'Bloquear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!ips.length && !carregando && (
          <p className="px-4 py-10 text-center text-[13px] text-zinc-500">
            Nenhum acesso registrado ainda. A partir de agora tudo que entrar aparece aqui.
          </p>
        )}
      </div>

      {/* --------------------------------------------------- histórico */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">
              {ipAberto ? `Tudo do endereço ${ipAberto}` : 'Últimos acessos'}
            </h2>
            <p className="text-[12px] text-zinc-500">
              {ipAberto ? 'Cada visita deste endereço.' : 'Clique num endereço acima para ver só ele.'}
            </p>
          </div>
          {ipAberto && (
            <button
              onClick={() => { setIpAberto(null); carregar(); }}
              className="min-h-[36px] rounded-lg border border-zinc-300 px-3 text-[12px] text-zinc-600 hover:border-roxo-400"
            >
              ver todos
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-[13px]">
            <tbody className="divide-y divide-zinc-100">
              {historico.map((a, n) => {
                const r = ROTULO_RESULTADO[a.resultado] || ROTULO_RESULTADO.ok;
                return (
                  <tr key={n}>
                    <td className="px-4 py-2.5 tabular-nums text-zinc-600">{a.ip}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${r.classe}`}>
                        {r.texto}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{a.usuario || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{a.rota}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500">{quando(a.quando)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
