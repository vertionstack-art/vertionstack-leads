'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lead } from '@/lib/db';
import {
  CATALOGO,
  FAMILIAS,
  FORMALIZACOES,
  PORTES,
  porId,
  type Familia,
  type Formalizacao,
  type Porte,
} from '@/lib/catalogo';
import {
  ALVO_MINIMO,
  PISO_ABSOLUTO,
  moeda,
  montarPropostas,
  sugerirMarcacoes,
  tetoDoPorte,
  textoDaProposta,
  type Marcacoes,
  type Nivel,
} from '@/lib/proposta';

const ORDEM_FAMILIAS: Familia[] = ['presenca', 'conversao', 'encontrar', 'conteudo', 'infra', 'recorrente'];

const CICLO: (Nivel | undefined)[] = [undefined, 'basico', 'intermediario', 'avancado'];

const COR_NIVEL: Record<Nivel, string> = {
  basico: 'bg-emerald-600 text-white border-emerald-600',
  intermediario: 'bg-roxo-600 text-white border-roxo-600',
  avancado: 'bg-tinta text-white border-tinta',
};

const SIGLA: Record<Nivel, string> = { basico: 'E', intermediario: 'C', avancado: 'P' };

export default function PropostaModal({
  lead,
  aoFechar,
  aoSalvar,
}: {
  lead: Lead;
  aoFechar: () => void;
  aoSalvar: (proposta: unknown) => void;
}) {
  const salvo = (lead.proposta || null) as {
    marcacoes?: Marcacoes;
    porte?: Porte;
    formalizacao?: Formalizacao;
    desconto?: number;
    ignorarTeto?: boolean;
  } | null;

  const [porte, setPorte] = useState<Porte>(salvo?.porte || 'micro');
  const [formalizacao, setFormalizacao] = useState<Formalizacao>(salvo?.formalizacao || 'desconhecido');
  const [marcacoes, setMarcacoes] = useState<Marcacoes>(
    salvo?.marcacoes || sugerirMarcacoes(lead.websiteKind, 'micro'),
  );
  const [desconto, setDesconto] = useState(salvo?.desconto || 0);
  const [ignorarTeto, setIgnorarTeto] = useState(salvo?.ignorarTeto || false);
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const planos = useMemo(
    () => montarPropostas({ marcacoes, porte, formalizacao, desconto, ignorarTeto }),
    [marcacoes, porte, formalizacao, desconto, ignorarTeto],
  );

  /** um clique avança o item para o próximo plano; volta ao "não incluso" no fim */
  function girar(id: string) {
    setMarcacoes((atual) => {
      const agora = atual[id];
      const proximo = CICLO[(CICLO.indexOf(agora) + 1) % CICLO.length];
      const novo = { ...atual, [id]: proximo };

      // só níveis alternativos do mesmo serviço se excluem (os três
      // suportes). Produtos diferentes somam: landing mais loja virtual
      // é escopo maior, não escolha entre um e outro.
      if (proximo) {
        for (const conflito of porId(id)?.conflitaCom || []) {
          if (conflito !== id) delete novo[conflito];
        }
      }
      return novo;
    });
  }

  async function salvar() {
    setGuardando(true);
    await aoSalvar({ marcacoes, porte, formalizacao, desconto, ignorarTeto });
    setGuardando(false);
  }

  function copiarTexto() {
    navigator.clipboard.writeText(textoDaProposta(lead.name, planos));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const nenhumMarcado = Object.values(marcacoes).every((v) => !v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={aoFechar}>
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* -------------------------------------------------------- topo */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">
              Montar proposta — {lead.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Clique em cada serviço para escolher em que plano ele entra. Os planos são cumulativos.
            </p>
          </div>
          <button
            onClick={aoFechar}
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_380px]">
          {/* ------------------------------------------------ escolhas */}
          <div className="min-h-0 overflow-auto border-r border-zinc-200 p-6">
            {/* porte */}
            <section className="mb-6">
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Porte do cliente
              </h3>
              <p className="mb-3 text-[12px] text-zinc-500">
                É o que mais mexe no preço. Cobrar de uma rede o mesmo que de uma barbearia de uma
                cadeira é perder dinheiro de um lado ou o cliente do outro.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(PORTES) as Porte[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPorte(p)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      porte === p ? 'border-roxo-600 bg-roxo-50 ring-2 ring-roxo-200' : 'border-zinc-200 hover:border-roxo-300'
                    }`}
                  >
                    <div className="text-[13px] font-semibold">{PORTES[p].titulo}</div>
                    <div className="mt-0.5 text-[10.5px] leading-snug text-zinc-500">{PORTES[p].descricao}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* formalização */}
            <section className="mb-6">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Como a empresa é registrada
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMALIZACOES) as Formalizacao[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormalizacao(f)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                      formalizacao === f ? 'border-roxo-600 bg-roxo-600 text-white' : 'border-zinc-300 hover:border-roxo-400'
                    }`}
                  >
                    {FORMALIZACOES[f].titulo}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">{FORMALIZACOES[formalizacao].dica}</p>
            </section>

            {/* legenda */}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-[11.5px] text-zinc-600">
              <span className="font-medium">Clique para incluir:</span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-emerald-600 bg-emerald-600 text-[10px] font-bold text-white">E</span>
                Essencial
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-roxo-600 bg-roxo-600 text-[10px] font-bold text-white">C</span>
                Completo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded border border-tinta bg-tinta text-[10px] font-bold text-white">P</span>
                Premium
              </span>
              <span className="text-zinc-400">· clicar de novo remove</span>
            </div>

            {/* serviços */}
            {ORDEM_FAMILIAS.map((fam) => (
              <section key={fam} className="mb-5">
                <h3 className="text-[12.5px] font-semibold">{FAMILIAS[fam].titulo}</h3>
                <p className="mb-2 text-[11.5px] text-zinc-500">{FAMILIAS[fam].explicacao}</p>

                <div className="space-y-1">
                  {CATALOGO.filter((s) => s.familia === fam).map((s) => {
                    const nivel = marcacoes[s.id];
                    return (
                      <button
                        key={s.id}
                        onClick={() => girar(s.id)}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          nivel ? 'border-zinc-300 bg-white' : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                            nivel ? COR_NIVEL[nivel] : 'border-zinc-300 bg-white text-transparent'
                          }`}
                        >
                          {nivel ? SIGLA[nivel] : '·'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] ${nivel ? 'font-medium text-tinta' : 'text-zinc-600'}`}>
                            {s.nome}
                          </span>
                          <span className="block text-[11px] leading-snug text-zinc-500">{s.beneficio}</span>
                        </span>
                        <span className="shrink-0 text-right text-[11.5px] text-zinc-500">
                          {s.preco > 0 ? moeda(s.preco) : 'incluso'}
                          {s.mensal && <span className="block text-[10px]">por mês</span>}
                          {s.custo > 0 && (
                            <span className="block text-[10px] text-amber-700">custa {moeda(s.custo)}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* -------------------------------------------------- planos */}
          <div className="min-h-0 overflow-auto bg-zinc-50 p-5">
            {nenhumMarcado ? (
              <p className="mt-8 text-center text-[13px] text-zinc-500">
                Marque os serviços ao lado para ver as três propostas.
              </p>
            ) : (
              <>
                {planos.map((p) => (
                  <div
                    key={p.nivel}
                    className={`mb-3 rounded-xl border bg-white p-4 ${
                      p.nivel === 'intermediario' ? 'border-roxo-400 ring-2 ring-roxo-100' : 'border-zinc-200'
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <h4 className="text-[13px] font-semibold uppercase tracking-wide">{p.rotulo}</h4>
                      {p.nivel === 'intermediario' && (
                        <span className="rounded-full bg-roxo-100 px-2 py-0.5 text-[10px] font-medium text-roxo-800">
                          o que mais fecha
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-tinta">
                      {p.entrada > 0 ? moeda(p.entrada) : '—'}
                    </div>
                    {p.mensalidade > 0 && (
                      <div className="text-[12.5px] text-zinc-600">
                        + <b className="tabular-nums">{moeda(p.mensalidade)}</b> por mês
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                      <span>{p.itens.filter((i) => !i.mensal).length} entregas</span>
                      {p.custoUnico > 0 && <span>seu custo {moeda(p.custoUnico)}</span>}
                      <span className={p.margemEntrada < 200 ? 'font-medium text-amber-700' : ''}>
                        sobra {moeda(p.margemEntrada)}
                      </span>
                    </div>

                    {p.avisos.map((a, i) => (
                      <p key={i} className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
                        {a}
                      </p>
                    ))}
                  </div>
                ))}

                <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Desconto de fechamento
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={desconto}
                      onChange={(e) => setDesconto(Number(e.target.value))}
                      className="flex-1 accent-roxo-600"
                    />
                    <span className="w-10 text-right text-[13px] font-medium tabular-nums">{desconto}%</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                    Piso de {moeda(PISO_ABSOLUTO)} e teto de {moeda(tetoDoPorte(porte))} para este porte.
                    O alvo é não sair abaixo de {moeda(ALVO_MINIMO)}.
                  </p>

                  <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-zinc-100 pt-3 text-[12px] text-zinc-700">
                    <input
                      type="checkbox"
                      checked={ignorarTeto}
                      onChange={(e) => setIgnorarTeto(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-roxo-600"
                    />
                    <span>
                      Liberar o teto
                      <span className="block text-[11px] leading-snug text-zinc-500">
                        Para escopo grande de verdade — duas entregas juntas, por exemplo. O piso continua valendo.
                      </span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <p className="text-[12px] text-zinc-500">
            A proposta fica salva neste lead — dá para retomar depois.
          </p>
          <div className="flex gap-2">
            <button
              onClick={copiarTexto}
              disabled={nenhumMarcado}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700 disabled:opacity-40"
            >
              {copiado ? 'Copiado!' : 'Copiar para WhatsApp'}
            </button>
            <button
              onClick={salvar}
              disabled={guardando}
              className="rounded-lg bg-roxo-600 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-roxo-700 disabled:opacity-60"
            >
              {guardando ? 'Salvando…' : 'Salvar proposta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
