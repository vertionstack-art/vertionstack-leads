'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Hourglass, MessageCircleReply, Search, Sparkles, Users } from 'lucide-react';
import { CLASSE_NIVEL, type Nivel } from '@/lib/temperatura';

/**
 * A lista das conversas. Os quatro blocos de cima são filtros: quem respondeu
 * e espera você (o mais importante, fica primeiro), quem você chamou e ainda
 * não respondeu, quem ainda nem foi chamado, e todos.
 */

export interface ItemConversa {
  id: string;
  nome: string;
  ramo: string | null;
  cidade: string | null;
  status: string;
  temperatura: Nivel;
  pontos: number;
  temWhatsapp: boolean;
  mensagens: number;
  ultimaEm: string | null;
  ultimoAutor: 'eu' | 'cliente' | null;
  ultimoTexto: string | null;
  passos: number;
}

type Filtro = 'responderam' | 'esperando' | 'novos' | 'todos';

const ROTULO_NIVEL: Record<Nivel, string> = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };
const ROTULO_STATUS: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  negociando: 'Negociando',
  fechado: 'Fechado',
};

function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  const dias = Math.round(min / 1440);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

function filtroDo(i: ItemConversa): Exclude<Filtro, 'todos'> {
  if (!i.mensagens) return 'novos';
  return i.ultimoAutor === 'cliente' ? 'responderam' : 'esperando';
}

export default function ListaConversas({ itens, totalPassos }: { itens: ItemConversa[]; totalPassos: number }) {
  const conta = useMemo(() => {
    const c = { responderam: 0, esperando: 0, novos: 0, todos: itens.length };
    for (const i of itens) c[filtroDo(i)]++;
    return c;
  }, [itens]);
  const [filtro, setFiltro] = useState<Filtro>(conta.responderam ? 'responderam' : conta.esperando ? 'esperando' : 'novos');
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState<Nivel | ''>('');

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => filtro === 'todos' || filtroDo(i) === filtro)
      .filter((i) => !nivel || i.temperatura === nivel)
      .filter((i) => !q || [i.nome, i.ramo, i.cidade].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => {
        // quem tem conversa: a mais recente primeiro; quem não tem: o mais quente primeiro
        if (a.ultimaEm && b.ultimaEm) return b.ultimaEm.localeCompare(a.ultimaEm);
        if (a.ultimaEm) return -1;
        if (b.ultimaEm) return 1;
        return b.pontos - a.pontos;
      });
  }, [itens, filtro, busca, nivel]);

  const blocos: { id: Filtro; titulo: string; detalhe: string; fundo: string; Icone: typeof Users }[] = [
    { id: 'responderam', titulo: 'Responderam', detalhe: 'esperando você', fundo: 'bg-rosa', Icone: MessageCircleReply },
    { id: 'esperando', titulo: 'Aguardando', detalhe: 'você chamou, falta responder', fundo: 'bg-manteiga', Icone: Hourglass },
    { id: 'novos', titulo: 'Para começar', detalhe: 'ainda sem conversa', fundo: 'bg-ceu', Icone: Sparkles },
    { id: 'todos', titulo: 'Todos', detalhe: 'todos os leads', fundo: 'bg-lavanda', Icone: Users },
  ];

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Filtrar conversas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {blocos.map(({ id, titulo, detalhe, fundo, Icone }) => {
          const sel = filtro === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setFiltro(id)}
              className={`flex min-h-[132px] flex-col rounded-[24px] p-5 text-left transition-[box-shadow,transform] ${fundo} ${
                sel ? 'shadow-[0_10px_28px_rgba(11,11,15,0.12)] ring-2 ring-tinta' : 'hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(11,11,15,0.08)]'
              }`}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{conta[id]}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${sel ? 'bg-tinta text-white' : 'bg-white text-tinta'}`}>
                  <Icone aria-hidden className="h-4 w-4" />
                </span>
              </span>
              <span className="mt-auto pt-3 text-[14px] font-extrabold">{titulo}</span>
              <span className="text-[12px] font-semibold text-zinc-700">{detalhe}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[340px]">
          <span className="sr-only">Procurar comércio</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, ramo ou cidade…"
            className="min-h-[44px] w-full rounded-full bg-zinc-100 pl-10 pr-4 text-[13.5px] font-medium outline-none placeholder:text-zinc-600 focus:bg-white focus:ring-2 focus:ring-roxo-200"
          />
        </label>
        {(['quente', 'morno', 'frio'] as Nivel[]).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={nivel === n}
            onClick={() => setNivel(nivel === n ? '' : n)}
            className={`min-h-[40px] rounded-full px-4 text-[12.5px] font-bold ring-1 ring-inset transition-colors ${
              nivel === n ? CLASSE_NIVEL[n] : 'bg-white text-zinc-700 ring-zinc-200 hover:ring-zinc-400'
            }`}
          >
            {ROTULO_NIVEL[n]}
          </button>
        ))}
        <span className="ml-auto text-[12.5px] font-semibold text-zinc-500">
          {lista.length} {lista.length === 1 ? 'lead' : 'leads'}
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="mt-4 rounded-[24px] bg-zinc-50 px-6 py-12 text-center ring-1 ring-inset ring-zinc-200">
          <p className="text-[15px] font-extrabold">Nada por aqui</p>
          <p className="mt-1 text-[13px] text-zinc-600">
            {filtro === 'responderam'
              ? 'Ninguém respondeu esperando você. Quando colar uma resposta do cliente numa conversa, ela aparece aqui.'
              : itens.length === 0
                ? 'Você ainda não tem leads. Busque comércios em Buscar leads.'
                : 'Nenhum lead com esses filtros.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-[24px] ring-1 ring-inset ring-zinc-200">
          {lista.map((i) => {
            const estado = filtroDo(i);
            const pct = Math.round((i.passos / totalPassos) * 100);
            return (
              <li key={i.id}>
                <Link
                  href={`/conversa/${encodeURIComponent(i.id)}`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-zinc-50 md:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1.4fr)_150px_auto] md:px-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-tinta text-[15px] font-extrabold uppercase text-white">
                    {i.nome.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-extrabold">{i.nome}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${CLASSE_NIVEL[i.temperatura]}`}>
                        {ROTULO_NIVEL[i.temperatura]}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] font-medium text-zinc-500">
                      {[i.ramo, i.cidade].filter(Boolean).join(' · ') || '—'}
                      {ROTULO_STATUS[i.status] ? ` · ${ROTULO_STATUS[i.status]}` : ''}
                    </span>
                  </span>

                  <span className="col-span-3 min-w-0 md:col-span-1">
                    {i.ultimoTexto ? (
                      <span className={`block rounded-[14px] px-3 py-2 text-[12.5px] leading-snug ${estado === 'responderam' ? 'bg-rosa' : 'bg-zinc-100'}`}>
                        <span className="font-extrabold">{i.ultimoAutor === 'cliente' ? 'Cliente' : 'Você'}</span>
                        {i.ultimaEm && <span className="font-semibold text-zinc-600"> · {haQuanto(i.ultimaEm)}</span>}
                        <span className="mt-0.5 block truncate text-zinc-800">{i.ultimoTexto}</span>
                      </span>
                    ) : (
                      <span className="block text-[12.5px] font-semibold text-zinc-500">
                        {i.temWhatsapp ? 'Ainda não começou' : 'Sem WhatsApp (telefone fixo)'}
                      </span>
                    )}
                  </span>

                  <span className="hidden md:block">
                    <span className="flex items-baseline justify-between text-[11.5px] font-bold text-zinc-600">
                      <span>Roteiro</span>
                      <span className="tabular-nums">{i.passos}/{totalPassos}</span>
                    </span>
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-zinc-200">
                      <span className="block h-full rounded-full bg-roxo-600" style={{ width: `${pct}%` }} />
                    </span>
                  </span>

                  <span
                    className={`col-start-3 row-start-1 inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition-colors sm:px-4 md:col-start-auto md:row-start-auto ${
                      estado === 'responderam' ? 'bg-tinta text-white group-hover:bg-tinta-70' : 'bg-zinc-100 text-tinta group-hover:bg-zinc-200'
                    }`}
                  >
                    <span className="hidden sm:inline">{estado === 'responderam' ? 'Responder' : estado === 'novos' ? 'Começar' : 'Abrir'}</span>
                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
