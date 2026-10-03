'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Linha {
  contaId: string;
  nome: string;
  plano: 'gratis' | 'basic' | 'pro' | 'cortesia';
  pagoAte: string | null;
  bloqueada: boolean;
  legado: boolean;
  criadaEm: string;
  membros: { email: string; nome: string; papel: string }[];
  leads: number;
  semana: number;
}

const ROTULO = { gratis: 'Free', basic: 'Basic', pro: 'Pro', cortesia: 'Cortesia' } as const;

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

export default function PainelContas() {
  const [contas, setContas] = useState<Linha[]>([]);
  const [minha, setMinha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState('');

  const carregar = useCallback(async () => {
    const r = await fetch('/api/admin/contas', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) {
      setContas(d.contas);
      setMinha(d.minhaConta);
    } else setErro(d.erro);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(corpo: Record<string, string>) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch('/api/admin/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!d.ok) return setErro(d.erro || 'Não deu certo.');
      setContas(d.contas);
      if (d.migracao) {
        setAviso(
          `Pronto: ${d.migracao.copiados} leads copiados do banco antigo` +
            (d.migracao.jaExistiam ? `, ${d.migracao.jaExistiam} já estavam aqui` : '') +
            (d.migracao.bloqueios ? ` e ${d.migracao.bloqueios} IPs bloqueados` : '') +
            '.',
        );
      }
      if (corpo.acao === 'juntar') {
        setEmail('');
        setAviso('Pronto, a pessoa agora divide a sua conta.');
      }
    } catch {
      setErro('Falha de rede.');
    } finally {
      setOcupado(false);
    }
  }

  const legadaJa = contas.some((c) => c.legado);
  const pagantes = contas.filter((c) => (c.plano === 'basic' || c.plano === 'pro') && c.pagoAte && new Date(c.pagoAte) > new Date()).length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">
          Contas{' '}
          <span className="text-[14px] font-bold tabular-nums text-zinc-500">
            {contas.length} no total · {pagantes} pagando
          </span>
        </h2>
      </div>

      {erro && <p role="alert" className="mt-4 rounded-2xl bg-zinc-100 px-5 py-3 text-[13px] font-semibold text-red-800 ring-2 ring-inset ring-red-700">{erro}</p>}
      {aviso && <p role="status" className="mt-4 rounded-2xl bg-zinc-100 px-5 py-3 text-[13px] font-semibold">{aviso}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {!legadaJa && (
          <div className="rounded-[24px] bg-tinta p-6 text-white">
            <h3 className="text-[17px] font-extrabold">Trazer os leads do banco antigo</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
              Copia todos os leads do Neon para a sua conta, com propostas, prévias e anotações. Os links de proposta
              que você já mandou continuam abrindo. Pode clicar de novo se algo falhar: o que já veio é pulado.
            </p>
            <button
              onClick={() => agir({ acao: 'migrar' })}
              disabled={ocupado}
              className="mt-4 min-h-[40px] rounded-full bg-ceu px-5 text-[13px] font-bold text-tinta transition-colors hover:bg-white disabled:opacity-60"
            >
              {ocupado ? 'Copiando…' : 'Copiar meus leads'}
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) agir({ acao: 'juntar', email: email.trim() });
          }}
          className="rounded-[24px] bg-zinc-50 p-6"
        >
          <h3 className="text-[17px] font-extrabold">Pôr alguém na sua equipe</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
            A pessoa cria a conta dela normalmente e depois você coloca o e-mail aqui. Ela passa a ver e trabalhar os
            mesmos leads que você.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="min-w-[220px] flex-1">
              <span className="sr-only">E-mail da pessoa</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="min-h-[40px] w-full rounded-full border border-zinc-200 bg-white px-4 text-[13px] outline-none focus:border-roxo-500"
              />
            </label>
            <button disabled={ocupado} className="min-h-[40px] rounded-full bg-tinta px-5 text-[13px] font-bold text-white disabled:opacity-60">
              Juntar
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead className="text-[12px] font-semibold text-zinc-500">
            <tr className="border-b border-zinc-100">
              <th className="py-3 pr-4 font-semibold">Conta</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Pago até</th>
              <th className="px-4 py-3 text-right font-semibold">Leads</th>
              <th className="px-4 py-3 text-right font-semibold">Nesta semana</th>
              <th className="px-4 py-3 font-semibold">Criada</th>
              <th className="py-3 pl-4"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.contaId} className={`border-b border-zinc-100 align-top ${c.bloqueada ? 'opacity-50' : ''}`}>
                <td className="py-3.5 pr-4">
                  <div className="font-bold">
                    {c.nome} {c.contaId === minha && <span className="text-[11px] font-semibold text-zinc-500">(você)</span>}
                  </div>
                  {c.membros.map((m) => (
                    <div key={m.email} className="text-[12px] text-zinc-500">
                      {m.email}
                      {m.papel === 'dono' ? '' : ' · membro'}
                    </div>
                  ))}
                  {c.bloqueada && <div className="text-[12px] font-bold text-red-800">suspensa</div>}
                </td>
                <td className="px-4 py-3.5">
                  <span className="relative inline-flex">
                    <select
                      value={c.plano}
                      onChange={(e) => agir({ acao: 'plano', contaId: c.contaId, plano: e.target.value })}
                      disabled={ocupado}
                      aria-label={`Plano de ${c.nome}`}
                      className="min-h-[34px] cursor-pointer appearance-none rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-8 text-[12px] font-semibold"
                    >
                      {Object.entries(ROTULO).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  </span>
                </td>
                <td className="px-4 py-3.5 tabular-nums">{c.plano === 'basic' || c.plano === 'pro' ? data(c.pagoAte) : '—'}</td>
                <td className="px-4 py-3.5 text-right font-bold tabular-nums">{c.leads}</td>
                <td className="px-4 py-3.5 text-right tabular-nums">{c.semana}</td>
                <td className="px-4 py-3.5 tabular-nums text-zinc-500">{data(c.criadaEm)}</td>
                <td className="py-3.5 pl-4 text-right">
                  {c.contaId !== minha && (
                    <button
                      onClick={() => agir({ acao: c.bloqueada ? 'liberar' : 'bloquear', contaId: c.contaId })}
                      disabled={ocupado}
                      className="text-[12px] font-semibold text-zinc-500 hover:text-red-700"
                    >
                      {c.bloqueada ? 'reativar' : 'suspender'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
