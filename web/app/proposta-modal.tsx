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
  montarProposta,
  normalizarMarcacoes,
  tetoDoPorte,
  textoDaProposta,
  type Marcacoes,
} from '@/lib/proposta';

const ORDEM_FAMILIAS: Familia[] = ['presenca', 'conversao', 'encontrar', 'conteudo', 'infra', 'recorrente'];


export default function PropostaModal({
  lead,
  aoFechar,
  aoSalvar,
  linkProposta,
}: {
  lead: Lead;
  aoFechar: () => void;
  aoSalvar: (proposta: unknown) => void;
  linkProposta: string;
}) {
  const salvo = (lead.proposta || null) as {
    marcacoes?: Marcacoes;
    porte?: Porte;
    formalizacao?: Formalizacao;
    desconto?: number;
    ignorarTeto?: boolean;
    fechado?: boolean;
  } | null;

  const [porte, setPorte] = useState<Porte>(salvo?.porte || 'micro');
  const [formalizacao, setFormalizacao] = useState<Formalizacao>(salvo?.formalizacao || 'desconhecido');
  /*
   * Abre sem nada marcado de propósito. Antes vinha uma sugestão pronta
   * com dezesseis serviços, e o trabalho virava desmarcar o que não cabia
   * — o contrário de escolher. Quem monta a proposta decide item a item o
   * que vai oferecer para aquele comércio.
   */
  const [marcacoes, setMarcacoes] = useState<Marcacoes>(normalizarMarcacoes(salvo?.marcacoes));
  const [desconto, setDesconto] = useState(salvo?.desconto || 0);
  const [ignorarTeto, setIgnorarTeto] = useState(salvo?.ignorarTeto || false);
  const [fechado, setFechado] = useState<boolean>(Boolean(salvo?.fechado));
  const [copiado, setCopiado] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [salvouAlgumaVez, setSalvouAlgumaVez] = useState(Boolean(lead.proposta));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const proposta = useMemo(
    () => montarProposta({ marcacoes, porte, formalizacao, desconto, ignorarTeto }),
    [marcacoes, porte, formalizacao, desconto, ignorarTeto],
  );

  /** liga ou desliga o serviço na proposta */
  function alternar(id: string) {
    setMarcacoes((atual) => {
      const ligando = !atual[id];
      const novo = { ...atual, [id]: ligando };
      if (!ligando) delete novo[id];

      // só níveis alternativos do mesmo serviço se excluem (os três
      // suportes). Produtos diferentes somam: landing mais loja virtual
      // é escopo maior, não escolha entre um e outro.
      if (ligando) {
        for (const conflito of porId(id)?.conflitaCom || []) {
          if (conflito !== id) delete novo[conflito];
        }
      }
      return novo;
    });
  }

  async function salvar() {
    setGuardando(true);
    await aoSalvar({ marcacoes, porte, formalizacao, desconto, ignorarTeto, fechado });
    setSalvouAlgumaVez(true);
    setGuardando(false);
  }

  function copiarTexto() {
    navigator.clipboard.writeText(textoDaProposta(lead.name, proposta, lead.previaUrl));
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
              Marque o que vai ser oferecido a este comércio. O preço se ajusta sozinho.
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

            {lead.previaUrl && (
              <p className="mb-3 rounded-xl border border-roxo-200 bg-roxo-50 px-3.5 py-2.5 text-[11.5px] leading-snug text-roxo-900">
                A prévia deste comércio entra na proposta e no texto do WhatsApp:{' '}
                <a
                  href={lead.previaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {lead.previaUrl.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}

            <div className="mb-4 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-[11.5px] text-zinc-600">
              Clique num serviço para incluir na proposta. Clique de novo para tirar.
            </div>

            {/* serviços */}
            {ORDEM_FAMILIAS.map((fam) => (
              <section key={fam} className="mb-5">
                <h3 className="text-[12.5px] font-semibold">{FAMILIAS[fam].titulo}</h3>
                <p className="mb-2 text-[11.5px] text-zinc-500">{FAMILIAS[fam].explicacao}</p>

                <div className="space-y-1">
                  {CATALOGO.filter((s) => s.familia === fam).map((s) => {
                    const incluso = Boolean(marcacoes[s.id]);
                    return (
                      <button
                        key={s.id}
                        onClick={() => alternar(s.id)}
                        aria-pressed={incluso}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          incluso ? 'border-roxo-300 bg-roxo-50' : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                            incluso ? 'border-roxo-600 bg-roxo-600 text-white' : 'border-zinc-300 bg-white text-transparent'
                          }`}
                        >
                          {incluso ? '✓' : '·'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] ${incluso ? 'font-medium text-tinta' : 'text-zinc-600'}`}>
                            {s.nome}
                          </span>
                          <span className="block text-[11px] leading-snug text-zinc-500">{s.beneficio}</span>
                        </span>
                        <span className="shrink-0 text-right text-[11.5px] text-zinc-500">
                          {s.preco > 0 ? moeda(s.preco) : 'incluso'}
                          {s.mensal && <span className="block text-[10px]">por mês</span>}
                          {s.brinde && (
                            <span
                              className="block text-[10px] text-roxo-700"
                              title="O cliente vê como cortesia, mas o valor entra no total"
                            >
                              vai como cortesia
                            </span>
                          )}
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

          {/* ------------------------------------------------- proposta */}
          <div className="min-h-0 overflow-auto bg-zinc-50 p-5">
            {nenhumMarcado ? (
              <p className="mt-8 text-center text-[13px] text-zinc-500">
                Marque ao lado o que vai ser oferecido. O preço aparece aqui.
              </p>
            ) : (
              <>
                <div className="mb-3 rounded-xl border border-roxo-400 bg-white p-4 ring-2 ring-roxo-100">
                  <h4 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
                    Valor da proposta
                  </h4>

                  <div className="mt-1.5 text-[28px] font-semibold tabular-nums text-tinta">
                    {proposta.entrada > 0 ? moeda(proposta.entrada) : '—'}
                  </div>
                  {proposta.mensalidade > 0 && (
                    <div className="text-[13px] text-zinc-600">
                      + <b className="tabular-nums">{moeda(proposta.mensalidade)}</b> por mês
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-zinc-100 pt-3 text-[11.5px] text-zinc-500">
                    <span>{proposta.itens.filter((i) => !i.mensal).length} entregas</span>
                    {proposta.itens.some((i) => i.mensal) && (
                      <span>{proposta.itens.filter((i) => i.mensal).length} mensais</span>
                    )}
                    {proposta.custoUnico > 0 && <span>seu custo {moeda(proposta.custoUnico)}</span>}
                    <span className={proposta.margemEntrada < 200 ? 'font-medium text-amber-700' : ''}>
                      sobra {moeda(proposta.margemEntrada)}
                    </span>
                  </div>

                  {proposta.avisos.map((a, i) => (
                    <p key={i} className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
                      {a}
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => setFechado(!fechado)}
                  className={`mb-3 min-h-[40px] w-full rounded-xl border text-[12.5px] font-medium transition ${
                    fechado
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-zinc-300 bg-white text-zinc-600 hover:border-emerald-500 hover:text-emerald-700'
                  }`}
                >
                  {fechado ? '✓ o cliente fechou' : 'marcar como fechado'}
                </button>

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
            {!salvouAlgumaVez
              ? 'Salve para liberar o link e o PDF que vão para o cliente.'
              : fechado
                ? 'Cliente fechou — o PDF verde é o documento de confirmação.'
                : 'Se o cliente fechar, marque acima para gerar o documento de confirmação.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={copiarTexto}
              disabled={nenhumMarcado}
              className="min-h-[44px] rounded-lg border border-zinc-300 px-4 text-[13px] font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700 disabled:opacity-40"
            >
              {copiado ? 'Copiado!' : 'Copiar texto'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(location.origin + linkProposta);
                setCopiadoLink(true);
                setTimeout(() => setCopiadoLink(false), 2000);
              }}
              disabled={!salvouAlgumaVez}
              title={salvouAlgumaVez ? 'Link da proposta para mandar ao cliente' : 'Salve a proposta primeiro'}
              className="min-h-[44px] rounded-lg border border-zinc-300 px-4 text-[13px] font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700 disabled:opacity-40"
            >
              {copiadoLink ? 'Link copiado!' : 'Copiar link'}
            </button>
            <a
              href={linkProposta}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!salvouAlgumaVez}
              onClick={(e) => { if (!salvouAlgumaVez) e.preventDefault(); }}
              className={`flex min-h-[44px] items-center rounded-lg border px-4 text-[13px] font-medium transition ${
                salvouAlgumaVez
                  ? 'border-zinc-300 text-zinc-700 hover:border-roxo-400 hover:text-roxo-700'
                  : 'pointer-events-none border-zinc-200 text-zinc-300'
              }`}
            >
              Ver proposta ↗
            </a>
            {fechado && (
              <a
                href={`${linkProposta}?fechado=1`}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!salvouAlgumaVez}
                onClick={(e) => { if (!salvouAlgumaVez) e.preventDefault(); }}
                className={`flex min-h-[44px] items-center rounded-lg px-4 text-[13px] font-semibold transition ${
                  salvouAlgumaVez
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'pointer-events-none bg-zinc-200 text-zinc-400'
                }`}
              >
                PDF do fechado ↗
              </a>
            )}
            <button
              onClick={salvar}
              disabled={guardando}
              className="min-h-[44px] rounded-lg bg-roxo-600 px-5 text-[13px] font-semibold text-white transition hover:bg-roxo-700 disabled:opacity-60"
            >
              {guardando ? 'Salvando…' : 'Salvar proposta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
