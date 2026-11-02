'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ExternalLink, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { CLASSE_NIVEL, type Nivel } from '@/lib/temperatura';
import { ROTULO_TOM, TONS, type RespostaCopiloto, type Tom } from '@/lib/copiloto-tipos';
import type { ItemFila } from '@/lib/fila';
import { partesDaMensagem } from '@/lib/partes';

/**
 * A fila em três tempos: você marca os leads, clica em "Gerar abordagens"
 * (a IA escreve uma por uma, no ritmo que o plano grátis aguenta) e depois
 * vai clicando em "Enviar" em cada cartão. Nada sai sozinho: cada envio é um
 * clique seu, e o teto de primeiras mensagens do dia vale no servidor.
 *
 * O que foi marcado e os textos ficam guardados neste navegador, para não
 * perder o trabalho se a página recarregar.
 */

const ROTULO_NIVEL: Record<Nivel, string> = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };
const GUARDA = 'vl-fila-v2';

type Estado = 'espera' | 'gerando' | 'pronto' | 'erro' | 'enviando' | 'enviada';

interface Rascunho {
  estado: Estado;
  texto: string;
  erro: string | null;
  resposta: RespostaCopiloto | null;
  avisos: string[];
  variacao: string | null;
  anteriores: string[];
}

const NOVO: Rascunho = { estado: 'espera', texto: '', erro: null, resposta: null, avisos: [], variacao: null, anteriores: [] };

async function chamar(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.erro || 'Não deu certo. Tente de novo.');
  return j;
}

const base = (id: string) => `/api/conversa/${encodeURIComponent(id)}`;

function lerGuardado(validos: Set<string>): { marcados: string[]; rascunhos: Record<string, Rascunho> } {
  try {
    const j = JSON.parse(localStorage.getItem(GUARDA) || '{}') as { marcados?: string[]; textos?: Record<string, string> };
    const marcados = (j.marcados || []).filter((id) => validos.has(id));
    const rascunhos: Record<string, Rascunho> = {};
    for (const id of marcados) {
      const t = j.textos?.[id];
      rascunhos[id] = t ? { ...NOVO, estado: 'pronto', texto: t } : { ...NOVO };
    }
    return { marcados, rascunhos };
  } catch {
    return { marcados: [], rascunhos: {} };
  }
}

export default function Fila({
  itens,
  enviadasHoje,
  limite,
  whatsappLigado,
  iaLigada,
}: {
  itens: ItemFila[];
  enviadasHoje: number;
  limite: number;
  whatsappLigado: boolean;
  iaLigada: boolean;
}) {
  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [hoje, setHoje] = useState(enviadasHoje);
  const [tom, setTom] = useState<Tom>('padrao');
  const [ideia, setIdeia] = useState('');
  const [gerandoLote, setGerandoLote] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const parar = useRef(false);
  const carregou = useRef(false);

  // volta o que estava marcado e escrito antes de recarregar a página
  useEffect(() => {
    const g = lerGuardado(new Set(itens.map((i) => i.id)));
    carregou.current = true;
    if (!g.marcados.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do navegador ao abrir
    setMarcados(g.marcados);
    setRascunhos(g.rascunhos);
  }, [itens]);

  // guarda a seleção e os textos (só os que ainda não foram enviados)
  useEffect(() => {
    if (!carregou.current) return;
    try {
      const pendentes = marcados.filter((id) => rascunhos[id]?.estado !== 'enviada');
      const textos: Record<string, string> = {};
      for (const id of pendentes) if (rascunhos[id]?.texto) textos[id] = rascunhos[id].texto;
      localStorage.setItem(GUARDA, JSON.stringify({ marcados: pendentes, textos }));
    } catch {
      // navegador sem armazenamento: segue sem guardar
    }
  }, [marcados, rascunhos]);

  const restam = Math.max(0, limite - hoje);
  const bloqueio = !whatsappLigado
    ? 'O WhatsApp da Vertion não está conectado. Conecte em Conversas → Conectar WhatsApp.'
    : restam === 0
      ? `Você já abriu ${limite} conversas hoje. Esse é o limite para proteger o número; amanhã libera de novo.`
      : null;

  const mudar = (id: string, p: Partial<Rascunho>) => setRascunhos((r) => ({ ...r, [id]: { ...NOVO, ...r[id], ...p } }));
  const ativos = marcados.filter((id) => rascunhos[id]?.estado !== 'enviada');
  const enviados = marcados.filter((id) => rascunhos[id]?.estado === 'enviada');
  const disponiveis = itens.filter((i) => !marcados.includes(i.id));
  const semTexto = ativos.filter((id) => !rascunhos[id]?.texto && rascunhos[id]?.estado !== 'gerando');
  const prontos = ativos.filter((id) => rascunhos[id]?.estado === 'pronto' && rascunhos[id]?.texto.trim());

  // ------------------------------------------------------------ seleção
  function alternar(id: string) {
    setAviso(null);
    if (marcados.includes(id)) {
      setMarcados((m) => m.filter((x) => x !== id));
      return;
    }
    if (ativos.length >= restam) {
      setAviso(`Hoje cabem só mais ${restam} ${restam === 1 ? 'primeira mensagem' : 'primeiras mensagens'}.`);
      return;
    }
    setMarcados((m) => [...m, id]);
    setRascunhos((r) => (r[id] ? r : { ...r, [id]: { ...NOVO } }));
  }

  function marcarMaisQuentes(n: number) {
    setAviso(null);
    const vagas = Math.max(0, restam - ativos.length);
    const novos = disponiveis.slice(0, Math.min(n, vagas)).map((i) => i.id);
    if (!novos.length) {
      setAviso(vagas ? 'Não há mais leads na fila.' : `Hoje cabem só mais ${restam} primeiras mensagens.`);
      return;
    }
    setMarcados((m) => [...m, ...novos]);
    setRascunhos((r) => {
      const c = { ...r };
      for (const id of novos) c[id] ??= { ...NOVO };
      return c;
    });
  }

  function tirar(id: string) {
    setMarcados((m) => m.filter((x) => x !== id));
  }

  // ------------------------------------------------------------ IA
  async function gerarUma(id: string, outra: boolean) {
    const atual = rascunhos[id] || NOVO;
    mudar(id, { estado: 'gerando', erro: null });
    try {
      const j = await chamar(`${base(id)}/copiloto`, {
        tarefa: 'abordagem',
        tom,
        pedido: ideia.trim(),
        anteriores: outra ? atual.anteriores : [],
        variacaoAnterior: outra ? atual.variacao : null,
      });
      const r: RespostaCopiloto = j.resposta;
      mudar(id, {
        estado: 'pronto',
        texto: r.mensagem || '',
        resposta: r,
        avisos: j.avisos || [],
        variacao: j.variacao?.id || null,
        anteriores: [...(outra ? atual.anteriores : []), r.mensagem].filter(Boolean).slice(-6),
      });
    } catch (e) {
      mudar(id, { estado: 'erro', erro: (e as Error).message });
    }
  }

  /** uma de cada vez: o plano grátis da IA aguenta poucas por minuto */
  async function gerarTodas() {
    if (!iaLigada || gerandoLote) return;
    const fila = [...semTexto];
    if (!fila.length) return;
    setGerandoLote(true);
    parar.current = false;
    for (const id of fila) {
      if (parar.current) break;
      await gerarUma(id, false);
    }
    setGerandoLote(false);
  }

  // ------------------------------------------------------------ envio
  async function enviar(id: string) {
    const r = rascunhos[id];
    const lead = porId.get(id);
    if (!r || !lead || bloqueio || r.estado === 'enviando') return;
    const t = r.texto.trim();
    if (!t) return;
    mudar(id, { estado: 'enviando', erro: null });
    try {
      await chamar(`${base(id)}/enviar`, { texto: t, passo: 'primeira', origemIa: r.resposta ? 'copiloto:abordagem' : null });
      setHoje((h) => h + 1);
      mudar(id, { estado: 'enviada' });
    } catch (e) {
      const msg = (e as Error).message;
      mudar(id, { estado: 'pronto', erro: msg });
      if (/limite/i.test(msg)) setHoje(limite);
    }
  }

  const pct = Math.min(100, Math.round((hoje / limite) * 100));

  return (
    <div className="mt-8 space-y-5">
      {/* placar do dia */}
      <section className="rounded-[24px] bg-ceu p-5">
        <p className="flex items-baseline gap-2">
          <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{hoje}</span>
          <span className="text-[14px] font-bold text-zinc-700">de {limite} conversas abertas hoje</span>
        </p>
        <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-white/70">
          <span className="block h-full rounded-full bg-tinta transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </span>
        <p className="mt-2 text-[12.5px] font-semibold text-zinc-700">
          {ativos.length} {ativos.length === 1 ? 'marcado' : 'marcados'} · {prontos.length} {prontos.length === 1 ? 'pronto' : 'prontos'} para enviar
          {enviados.length > 0 && ` · ${enviados.length} ${enviados.length === 1 ? 'enviado' : 'enviados'} agora`}
        </p>
      </section>

      {bloqueio && (
        <p role="alert" className="flex items-start gap-2 rounded-[18px] bg-manteiga px-4 py-3 text-[13px] font-semibold text-amber-950">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {bloqueio}
        </p>
      )}
      {aviso && <p role="status" className="text-[13px] font-bold text-amber-900">{aviso}</p>}

      {/* 1. os marcados: gerar e enviar */}
      {ativos.length > 0 && (
        <section className="rounded-[24px] bg-white p-4 ring-1 ring-inset ring-zinc-200 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold">Para enviar</h2>
            {iaLigada && (
              <button
                type="button"
                onClick={gerandoLote ? () => (parar.current = true) : gerarTodas}
                disabled={!gerandoLote && !semTexto.length}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-tinta px-5 text-[14px] font-extrabold text-white transition-colors hover:bg-tinta-70 disabled:opacity-40"
              >
                {gerandoLote ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
                {gerandoLote
                  ? `Gerando… (parar)`
                  : semTexto.length
                    ? `Gerar ${semTexto.length === 1 ? 'abordagem' : `${semTexto.length} abordagens`}`
                    : 'Todas geradas'}
              </button>
            )}
          </div>

          {/* tom e ideia valem para as próximas que a IA escrever */}
          {iaLigada && (
            <div className="mt-3 rounded-[18px] bg-lavanda p-3">
              <div className="flex flex-wrap gap-1.5">
                {TONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tom === t}
                    onClick={() => setTom(t)}
                    className={`min-h-[34px] rounded-full px-3 text-[12px] font-bold transition-colors ${tom === t ? 'bg-tinta text-white' : 'bg-white/70 hover:bg-white'}`}
                  >
                    {ROTULO_TOM[t]}
                  </button>
                ))}
              </div>
              <input
                value={ideia}
                onChange={(e) => setIdeia(e.target.value)}
                placeholder="Ideia para a IA (opcional), vale para todas: ex. fale do Instagram parado"
                aria-label="Ideia para a IA"
                className="mt-2 min-h-[42px] w-full rounded-full bg-white px-4 text-[13px] outline-none focus:ring-2 focus:ring-roxo-200"
              />
              {gerandoLote && <p className="mt-2 text-[12px] font-semibold text-zinc-700">A IA grátis escreve algumas por minuto. Pode ir enviando as que ficarem prontas.</p>}
            </div>
          )}

          <ul className="mt-4 grid gap-3">
            {ativos.map((id) => {
              const l = porId.get(id);
              const r = rascunhos[id] || NOVO;
              if (!l) return null;
              const ocupado = r.estado === 'gerando' || r.estado === 'enviando';
              return (
                <li key={id} className="rounded-[20px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15.5px] font-extrabold">{l.nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[l.temperatura]}`}>{ROTULO_NIVEL[l.temperatura]}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-zinc-500">{[l.ramo, l.cidade].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <Link
                      href={`/conversa/${encodeURIComponent(id)}`}
                      target="_blank"
                      aria-label={`Ver ficha de ${l.nome}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100"
                    >
                      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => tirar(id)}
                      disabled={ocupado}
                      aria-label={`Tirar ${l.nome} da lista`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100 disabled:opacity-40"
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative mt-3">
                    <textarea
                      value={r.texto}
                      onChange={(e) => mudar(id, { texto: e.target.value, estado: e.target.value.trim() ? 'pronto' : 'espera' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          enviar(id);
                        }
                      }}
                      rows={4}
                      disabled={ocupado}
                      aria-label={`Mensagem para ${l.nome}`}
                      placeholder={iaLigada ? 'Clique em "Gerar" ou escreva a mensagem…' : 'Escreva a mensagem…'}
                      className="w-full resize-y rounded-[16px] bg-white px-4 py-3 text-[14.5px] leading-relaxed outline-none ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-roxo-200 disabled:opacity-60"
                    />
                    {r.estado === 'gerando' && (
                      <span className="absolute inset-0 flex items-center justify-center gap-2 rounded-[16px] bg-white/70 text-[13px] font-bold text-zinc-600">
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> A IA está escrevendo…
                      </span>
                    )}
                  </div>

                  {r.texto.trim() && (
                    <p className="mt-1.5 text-[11.5px] font-semibold text-zinc-500">
                      {(() => {
                        const n = partesDaMensagem(r.texto).length;
                        return n > 1 ? `Vai em ${n} mensagens, com "digitando…" entre elas. Cada linha em branco separa uma mensagem.` : 'Vai em 1 mensagem. Deixe uma linha em branco para separar em até 3.';
                      })()}
                    </p>
                  )}
                  {r.erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{r.erro}</p>}
                  {r.resposta && r.resposta.acao !== 'escrever' && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold text-amber-900">
                      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A IA sugere não mandar agora: {r.resposta.leitura || r.resposta.por_que}
                    </p>
                  )}
                  {r.resposta?.precisa_confirmar && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold text-amber-900">
                      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Confirme antes: {r.resposta.precisa_confirmar}
                    </p>
                  )}
                  {r.avisos.map((a) => (
                    <p key={a} className="mt-1 text-[12.5px] font-semibold text-amber-900">{a}</p>
                  ))}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => enviar(id)}
                      disabled={ocupado || !r.texto.trim() || Boolean(bloqueio)}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-tinta px-6 text-[14.5px] font-extrabold text-white transition-colors hover:bg-tinta-70 disabled:opacity-40"
                    >
                      {r.estado === 'enviando' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
                      Enviar
                    </button>
                    {iaLigada && (
                      <button
                        type="button"
                        onClick={() => gerarUma(id, Boolean(r.texto))}
                        disabled={ocupado || gerandoLote}
                        className="inline-flex min-h-[46px] items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100 disabled:opacity-40"
                      >
                        {r.texto ? <RotateCcw aria-hidden className="h-4 w-4" /> : <Sparkles aria-hidden className="h-4 w-4" />}
                        {r.texto ? 'Outra abordagem' : 'Gerar'}
                      </button>
                    )}
                    <span className="ml-auto hidden text-[11.5px] font-semibold text-zinc-500 sm:inline">Ctrl + Enter envia</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* enviados nesta rodada */}
      {enviados.length > 0 && (
        <section className="rounded-[24px] bg-menta/60 px-5 py-4">
          <p className="text-[13px] font-extrabold text-emerald-950">Enviados agora</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {enviados.map((id) => (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-bold text-emerald-950">
                <Check aria-hidden className="h-3.5 w-3.5" /> {porId.get(id)?.nome}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] font-semibold text-emerald-900">Quem responder cai direto no robô.</p>
        </section>
      )}

      {/* 2. a fila: marcar quem vai receber */}
      {!itens.length ? (
        <div className="rounded-[24px] bg-zinc-50 px-6 py-12 text-center ring-1 ring-inset ring-zinc-200">
          <p className="text-[15px] font-extrabold">A fila está vazia</p>
          <p className="mt-1 text-[13px] text-zinc-600">Todo lead com celular já recebeu a primeira mensagem. Busque mais em Buscar leads.</p>
        </div>
      ) : (
        <section className="rounded-[24px] ring-1 ring-inset ring-zinc-200">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <div>
              <h2 className="text-[15px] font-extrabold">Escolha quem vai receber</h2>
              <p className="text-[12.5px] text-zinc-500">
                {disponiveis.length} na fila, o mais quente primeiro · hoje cabem mais {Math.max(0, restam - ativos.length)}
              </p>
            </div>
            <div className="flex gap-2">
              {[5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => marcarMaisQuentes(n)}
                  disabled={!disponiveis.length || ativos.length >= restam}
                  className="inline-flex min-h-[38px] items-center rounded-full bg-zinc-100 px-3.5 text-[12.5px] font-bold transition-colors hover:bg-zinc-200 disabled:opacity-40"
                >
                  Marcar {n} mais quentes
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-3 divide-y divide-zinc-200">
            {disponiveis.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => alternar(l.id)}
                    className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0b0b0f]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold">{l.nome}</span>
                    <span className="block truncate text-[12px] text-zinc-500">
                      {[l.ramo, l.cidade].filter(Boolean).join(' · ') || '—'}
                      {l.motivos[0] ? ` · ${l.motivos[0]}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[l.temperatura]}`}>{ROTULO_NIVEL[l.temperatura]}</span>
                </label>
              </li>
            ))}
            {!disponiveis.length && <li className="px-5 py-6 text-center text-[13px] text-zinc-500">Todos os leads da fila já estão marcados.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
