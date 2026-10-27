'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Loader2, Pause, Play, Send, SkipForward, Sparkles } from 'lucide-react';
import { CLASSE_NIVEL, type Nivel } from '@/lib/temperatura';
import { ROTULO_TOM, TONS, type RespostaCopiloto, type Tom } from '@/lib/copiloto-tipos';
import type { ItemFila } from '@/lib/fila';

/**
 * A fila em si. "Iniciar" abre o primeiro lead com a abordagem escrita pela
 * IA; cada "Enviar" é um clique seu e manda UMA mensagem. Enquanto você lê
 * uma, a do próximo lead já está sendo escrita, para não esperar.
 */

const ROTULO_NIVEL: Record<Nivel, string> = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };

interface Rascunho {
  carregando: boolean;
  texto: string;
  erro: string | null;
  resposta: RespostaCopiloto | null;
  avisos: string[];
  variacao: string | null;
  anteriores: string[];
}

const VAZIO: Rascunho = { carregando: false, texto: '', erro: null, resposta: null, avisos: [], variacao: null, anteriores: [] };

async function chamar(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.erro || 'Não deu certo. Tente de novo.');
  return j;
}

const base = (id: string) => `/api/conversa/${encodeURIComponent(id)}`;

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
  const [fila, setFila] = useState(itens);
  const [rodando, setRodando] = useState(false);
  const [hoje, setHoje] = useState(enviadasHoje);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [tom, setTom] = useState<Tom>('padrao');
  const [ideia, setIdeia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedidos = useRef(new Set<string>());

  const atual = fila[0] || null;
  const restam = Math.max(0, limite - hoje);
  const bloqueio = !whatsappLigado
    ? 'O WhatsApp da Vertion não está conectado. Conecte em Conversas → Conectar WhatsApp.'
    : restam === 0
      ? `Você já abriu ${limite} conversas hoje. Esse é o limite para proteger o número; amanhã libera de novo.`
      : null;

  const mudar = (id: string, p: Partial<Rascunho>) => setRascunhos((r) => ({ ...r, [id]: { ...VAZIO, ...r[id], ...p } }));

  /** pede ao copiloto a abordagem de um lead; "outra" pede um jeito diferente do anterior */
  const gerar = useCallback(
    async (id: string, opcoes: { tom: Tom; pedido: string; anteriores: string[]; variacaoAnterior: string | null }) => {
      if (pedidos.current.has(id)) return;
      pedidos.current.add(id);
      mudar(id, { carregando: true, erro: null });
      try {
        const j = await chamar(`${base(id)}/copiloto`, { tarefa: 'abordagem', ...opcoes });
        const r: RespostaCopiloto = j.resposta;
        mudar(id, {
          carregando: false,
          texto: r.mensagem || '',
          resposta: r,
          avisos: j.avisos || [],
          variacao: j.variacao?.id || null,
          anteriores: [...opcoes.anteriores, r.mensagem].filter(Boolean).slice(-6),
        });
      } catch (e) {
        mudar(id, { carregando: false, erro: (e as Error).message });
      } finally {
        pedidos.current.delete(id);
      }
    },
    [],
  );

  // o lead da vez e o seguinte já ganham a abordagem (cada um só uma vez)
  const pedidosFeitos = useRef(new Set<string>());
  function preparar(lista: ItemFila[]) {
    if (!iaLigada) return;
    for (const l of lista.slice(0, 2)) {
      if (pedidosFeitos.current.has(l.id)) continue;
      pedidosFeitos.current.add(l.id);
      gerar(l.id, { tom, pedido: '', anteriores: [], variacaoAnterior: null });
    }
  }

  function alternar() {
    if (!rodando) preparar(fila);
    setRodando(!rodando);
  }

  const r = atual ? rascunhos[atual.id] || VAZIO : VAZIO;

  function outra() {
    if (!atual) return;
    gerar(atual.id, { tom, pedido: ideia.trim(), anteriores: r.anteriores, variacaoAnterior: r.variacao });
  }

  function avancar() {
    const resto = fila.slice(1);
    setFila(resto);
    if (rodando) preparar(resto);
    setIdeia('');
    setErro(null);
  }

  function pular() {
    if (!atual) return;
    setAviso(`${atual.nome} ficou de fora desta rodada.`);
    avancar();
  }

  async function enviar() {
    if (!atual || enviando || bloqueio) return;
    const t = r.texto.trim();
    if (!t) return;
    setEnviando(true);
    setErro(null);
    try {
      await chamar(`${base(atual.id)}/enviar`, { texto: t, passo: 'primeira', origemIa: r.resposta ? 'copiloto:abordagem' : null });
      setHoje((h) => h + 1);
      setAviso(`Enviada para ${atual.nome}.`);
      avancar();
    } catch (e) {
      setErro((e as Error).message);
      if (/limite/i.test((e as Error).message)) setHoje(limite);
    } finally {
      setEnviando(false);
    }
  }

  const pct = Math.min(100, Math.round((hoje / limite) * 100));

  return (
    <div className="mt-8 space-y-5">
      {/* o placar do dia e o botão de iniciar */}
      <section className="flex flex-wrap items-center gap-5 rounded-[24px] bg-ceu p-5">
        <div className="min-w-[220px] flex-1">
          <p className="flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{hoje}</span>
            <span className="text-[14px] font-bold text-zinc-700">de {limite} conversas abertas hoje</span>
          </p>
          <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-white/70">
            <span className="block h-full rounded-full bg-tinta transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </span>
          <p className="mt-2 text-[12.5px] font-semibold text-zinc-700">
            {fila.length} {fila.length === 1 ? 'lead esperando' : 'leads esperando'} na fila · o mais quente primeiro
          </p>
        </div>
        <button
          type="button"
          onClick={alternar}
          disabled={!fila.length || (!rodando && Boolean(bloqueio))}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-tinta px-7 text-[15px] font-extrabold text-white transition-colors hover:bg-tinta-70 disabled:opacity-40"
        >
          {rodando ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
          {rodando ? 'Pausar' : 'Iniciar'}
        </button>
      </section>

      {bloqueio && (
        <p role="alert" className="flex items-start gap-2 rounded-[18px] bg-manteiga px-4 py-3 text-[13px] font-semibold text-amber-950">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {bloqueio}
        </p>
      )}
      {!iaLigada && (
        <p className="rounded-[18px] bg-zinc-100 px-4 py-3 text-[13px] font-semibold text-zinc-700">
          A IA está desligada: escreva a mensagem de cada lead à mão no campo abaixo.
        </p>
      )}
      {aviso && <p role="status" className="text-[13px] font-bold text-emerald-800">{aviso}</p>}

      {!fila.length ? (
        <div className="rounded-[24px] bg-zinc-50 px-6 py-12 text-center ring-1 ring-inset ring-zinc-200">
          <p className="text-[15px] font-extrabold">A fila está vazia</p>
          <p className="mt-1 text-[13px] text-zinc-600">Todo lead com celular já recebeu a primeira mensagem. Busque mais em Buscar leads.</p>
        </div>
      ) : rodando && atual ? (
        /* o lead da vez */
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-inset ring-zinc-200 md:p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-[20px] font-extrabold tracking-[-0.02em]">{atual.nome}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[atual.temperatura]}`}>
                  {ROTULO_NIVEL[atual.temperatura]}
                </span>
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-zinc-500">{[atual.ramo, atual.cidade].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <Link
              href={`/conversa/${encodeURIComponent(atual.id)}`}
              target="_blank"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 text-[12.5px] font-bold transition-colors hover:bg-zinc-200"
            >
              Ver ficha <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          {atual.motivos.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {atual.motivos.map((m) => (
                <li key={m} className="rounded-full bg-lavanda px-2.5 py-1 text-[12px] font-semibold">{m}</li>
              ))}
            </ul>
          )}

          <label htmlFor="msg-fila" className="mt-5 block text-[12.5px] font-extrabold">Primeira mensagem</label>
          <div className="relative mt-1.5">
            <textarea
              id="msg-fila"
              value={r.texto}
              onChange={(e) => mudar(atual.id, { texto: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={5}
              disabled={r.carregando}
              placeholder={r.carregando ? '' : 'Escreva a mensagem…'}
              className="w-full resize-y rounded-[18px] bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed outline-none ring-1 ring-inset ring-zinc-200 focus:bg-white focus:ring-2 focus:ring-roxo-200 disabled:opacity-60"
            />
            {r.carregando && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-bold text-zinc-600">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> A IA está escrevendo…
              </span>
            )}
          </div>
          {r.erro && <p className="mt-2 text-[12.5px] font-semibold text-red-700">{r.erro}</p>}
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

          {/* gerar outra abordagem com a IA */}
          {iaLigada && (
            <div className="mt-4 rounded-[18px] bg-lavanda p-3.5">
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
              <div className="mt-2.5 flex flex-wrap gap-2">
                <input
                  value={ideia}
                  onChange={(e) => setIdeia(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), outra())}
                  placeholder="Ideia para a IA (opcional): ex. fale do Instagram parado"
                  aria-label="Ideia para a IA"
                  className="min-h-[42px] min-w-[200px] flex-1 rounded-full bg-white px-4 text-[13px] outline-none focus:ring-2 focus:ring-roxo-200"
                />
                <button
                  type="button"
                  onClick={outra}
                  disabled={r.carregando}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-extrabold transition-colors hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Sparkles aria-hidden className="h-4 w-4" /> Gerar outra abordagem
                </button>
              </div>
            </div>
          )}

          {erro && <p role="alert" className="mt-3 text-[13px] font-semibold text-red-700">{erro}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || r.carregando || !r.texto.trim() || Boolean(bloqueio)}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-tinta px-7 text-[15px] font-extrabold text-white transition-colors hover:bg-tinta-70 disabled:opacity-40"
            >
              {enviando ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
              Enviar e ir para o próximo
            </button>
            <button
              type="button"
              onClick={pular}
              disabled={enviando}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-zinc-200 px-5 text-[14px] font-bold transition-colors hover:border-zinc-400"
            >
              <SkipForward aria-hidden className="h-4 w-4" /> Pular
            </button>
            <span className="ml-auto hidden text-[12px] font-semibold text-zinc-500 sm:inline">Ctrl + Enter também envia</span>
          </div>
        </section>
      ) : (
        /* parado: quem vem primeiro */
        <section className="rounded-[24px] ring-1 ring-inset ring-zinc-200">
          <p className="px-5 pt-4 text-[12.5px] font-extrabold text-zinc-600">Próximos da fila</p>
          <ol className="mt-2 divide-y divide-zinc-200">
            {fila.slice(0, 8).map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-5 text-[12px] font-bold tabular-nums text-zinc-500">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-extrabold">{l.nome}</span>
                  <span className="block truncate text-[12px] text-zinc-500">{[l.ramo, l.cidade].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[l.temperatura]}`}>{ROTULO_NIVEL[l.temperatura]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
