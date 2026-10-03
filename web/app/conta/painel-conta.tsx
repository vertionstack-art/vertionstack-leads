'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, KeyRound, Laptop } from 'lucide-react';

interface Info {
  email: string;
  nome: string;
  plano: 'gratis' | 'pago' | 'cortesia';
  pagoAte: string | null;
  chave: {
    prefixo: string;
    criadaEm: string;
    ultimoUso: string | null;
    aparelhos: { id: string; primeiroUso: string; ultimoUso: string }[];
  } | null;
  cota: { ilimitado: boolean; usados: number; limite: number; restantes: number | null; renovaEm: string };
  maxAparelhos: number;
}

const ROTULO = { gratis: 'Plano grátis', pago: 'Assinante', cortesia: 'Cortesia' } as const;

function quando(iso: string | null) {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function PainelConta() {
  const [info, setInfo] = useState<Info | null>(null);
  const [chaveNova, setChaveNova] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch('/api/conta', { cache: 'no-store' });
    const d = await r.json();
    if (d.ok) setInfo(d);
    else setErro(d.erro);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(corpo: Record<string, string>) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!d.ok) return setErro(d.erro || 'Não deu certo.');
      setInfo((a) => (a ? { ...a, ...d } : a));
      setChaveNova(d.chaveNova || null);
      setCopiado(false);
    } catch {
      setErro('Falha de rede.');
    } finally {
      setOcupado(false);
    }
  }

  if (!info) {
    return <div className="mt-10 h-40 animate-pulse rounded-[24px] bg-zinc-100" aria-label="Carregando" />;
  }

  const { cota } = info;
  const renova = new Date(cota.renovaEm).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

  return (
    <div className="mt-8 space-y-6">
      {erro && <p role="alert" className="rounded-2xl bg-zinc-100 px-5 py-3 text-[13px] font-semibold text-red-800 ring-2 ring-inset ring-red-700">{erro}</p>}

      {/* ------------------------------------------------------- plano */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[24px] bg-ceu p-6">
          <p className="text-[13px] font-bold text-sky-950/70">{ROTULO[info.plano]}</p>
          {cota.ilimitado ? (
            <>
              <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em]">Sem limite</p>
              <p className="mt-2 text-[13px] font-semibold text-sky-950/70">
                {info.plano === 'pago' && info.pagoAte
                  ? `Assinatura em dia até ${new Date(info.pagoAte).toLocaleDateString('pt-BR')}.`
                  : 'Acesso liberado pela Vertion.'}{' '}
                {cota.usados} leads novos nesta semana.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                {cota.usados}
                <span className="text-[22px] text-sky-950/50"> / {cota.limite}</span>
              </p>
              <p className="mt-2 text-[13px] font-semibold text-sky-950/70">leads novos nesta semana. Renova {renova}.</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70" aria-hidden>
                <div className="h-full rounded-full bg-tinta" style={{ width: `${Math.min(100, (cota.usados / cota.limite) * 100)}%` }} />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col rounded-[24px] bg-tinta p-6 text-white">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
            Coletar{' '}
            <span className="inline-block -rotate-2 rounded-full border border-white/70 px-2.5 py-0.5 text-[18px]">sem limite</span>
          </h2>
          <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-white/70">
            {info.plano === 'gratis'
              ? 'A assinatura mensal libera leads novos sem teto semanal, na extensão e no cadastro manual.'
              : 'Sua conta já coleta sem limite.'}
          </p>
          {info.plano === 'gratis' && (
            <span className="mt-auto inline-flex min-h-[40px] w-fit items-center rounded-full border border-white/30 px-4 pt-0 text-[13px] font-bold text-white/80">
              Assinatura abre em breve
            </span>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ chave da extensão */}
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.02em]">
              <KeyRound aria-hidden className="h-5 w-5" /> Chave da extensão
            </h2>
            <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-zinc-600">
              Cole na engrenagem da extensão. Ela é só sua e vale em até {info.maxAparelhos} computadores. Gerar uma nova
              desliga a anterior na hora.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => agir({ acao: 'gerar' })}
              disabled={ocupado}
              className="min-h-[40px] rounded-full bg-tinta px-5 text-[13px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:opacity-60"
            >
              {info.chave ? 'Gerar nova chave' : 'Gerar minha chave'}
            </button>
            {info.chave && (
              <button
                onClick={() => {
                  if (confirm('Desligar a chave? A extensão para de enviar até você gerar outra.')) agir({ acao: 'revogar' });
                }}
                disabled={ocupado}
                className="min-h-[40px] rounded-full border border-zinc-200 px-4 text-[13px] font-bold text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-60"
              >
                Desligar
              </button>
            )}
          </div>
        </div>

        {chaveNova && (
          <div className="mt-5 rounded-2xl bg-zinc-100 p-4">
            <p className="text-[13px] font-bold">Copie agora: por segurança, ela não aparece de novo.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2.5 text-[13px] font-semibold">{chaveNova}</code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(chaveNova);
                    setCopiado(true);
                  } catch {
                    setErro('Não consegui copiar sozinho: selecione a chave e use Ctrl+C.');
                  }
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[13px] font-bold text-white"
              >
                {copiado ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
                {copiado ? 'Copiada' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        {info.chave ? (
          <div className="mt-5">
            <p className="text-[13px] text-zinc-600">
              Chave ativa começando com <b className="text-tinta">{info.chave.prefixo}…</b>, criada em {quando(info.chave.criadaEm)}, último uso{' '}
              {quando(info.chave.ultimoUso)}.
            </p>
            <h3 className="mt-5 text-[13px] font-bold">
              Computadores ({info.chave.aparelhos.length} de {info.maxAparelhos})
            </h3>
            {info.chave.aparelhos.length ? (
              <ul className="mt-2 divide-y divide-zinc-100">
                {info.chave.aparelhos.map((a, i) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2.5 text-[13px]">
                      <Laptop aria-hidden className="h-4 w-4 text-zinc-500" />
                      Computador {i + 1}
                      <span className="text-zinc-500">· usado em {quando(a.ultimoUso)}</span>
                    </span>
                    <button
                      onClick={() => agir({ acao: 'soltar', aparelho: a.id })}
                      disabled={ocupado}
                      className="text-[12.5px] font-semibold text-zinc-500 hover:text-red-700"
                    >
                      liberar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-zinc-500">Nenhum ainda. O primeiro entra quando a extensão se conectar.</p>
            )}
          </div>
        ) : (
          !chaveNova && <p className="mt-5 text-[13px] text-zinc-500">Você ainda não tem chave. Gere uma para conectar a extensão.</p>
        )}
      </section>

      {/* ------------------------------------------------------- acesso */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-zinc-50 px-6 py-5">
        <p className="text-[13px] text-zinc-600">
          Entra como <b className="text-tinta">{info.email}</b>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/extensao" className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-bold hover:border-zinc-400">
            Baixar a extensão
          </Link>
          <Link href="/nova-senha" className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-bold hover:border-zinc-400">
            Trocar senha
          </Link>
        </div>
      </section>
    </div>
  );
}
