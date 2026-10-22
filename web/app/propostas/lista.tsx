'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight, BadgeCheck, Check, Eye, FilePen, FileText, Link2, Plus, Search, Store, Trash2, UserRound, X,
} from 'lucide-react';
import type { Lead } from '@/lib/db';
import { moeda, montarProposta, normalizarMarcacoes } from '@/lib/proposta';
import type { Formalizacao, Porte } from '@/lib/catalogo';
import PropostaModal from '@/app/proposta-modal';

/**
 * A lista das propostas. Os blocos de cima são filtros pela situação: a
 * montar, enviadas que o cliente ainda não abriu, abertas, aceitas online e
 * fechadas. "Nova proposta" cria uma avulsa (sem cadastrar cliente) e já
 * abre o montador.
 */

type Situacao = 'rascunho' | 'enviada' | 'aberta' | 'aceita' | 'fechada';
type Filtro = Situacao | 'todas';

interface Cfg {
  marcacoes?: unknown;
  porte?: Porte;
  formalizacao?: Formalizacao;
  desconto?: number;
  ignorarTeto?: boolean;
  entradaManual?: number | null;
  mensalidadeManual?: number | null;
  fechado?: boolean;
  aceite?: { em?: string };
}

function situacaoDe(l: Lead): Situacao {
  const p = l.proposta as Cfg | null;
  if (!p) return 'rascunho';
  if (p.fechado) return 'fechada';
  if (p.aceite?.em) return 'aceita';
  if (l.propostaAberturas > 0) return 'aberta';
  return 'enviada';
}

/** o mesmo cálculo do montador, para a lista mostrar o valor sem abrir a proposta */
function valoresDe(l: Lead): { entrada: number; mensalidade: number } | null {
  const p = l.proposta as Cfg | null;
  if (!p) return null;
  try {
    const r = montarProposta({
      marcacoes: normalizarMarcacoes(p.marcacoes),
      porte: p.porte || 'micro',
      formalizacao: p.formalizacao || 'desconhecido',
      desconto: p.desconto,
      ignorarTeto: p.ignorarTeto,
      entradaManual: p.entradaManual,
      mensalidadeManual: p.mensalidadeManual,
    });
    return { entrada: r.entrada, mensalidade: r.mensalidade };
  } catch {
    return null;
  }
}

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const SELO: Record<Situacao, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: 'A montar', classe: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  enviada: { rotulo: 'Não abriu ainda', classe: 'bg-ceu text-sky-950 ring-sky-200' },
  aberta: { rotulo: 'Abriu', classe: 'bg-manteiga text-amber-950 ring-amber-200' },
  aceita: { rotulo: 'Aceitou online', classe: 'bg-rosa text-rose-950 ring-rose-200' },
  fechada: { rotulo: 'Fechada', classe: 'bg-menta text-emerald-950 ring-emerald-200' },
};

export default function ListaPropostas({ inicial }: { inicial: Lead[] }) {
  const router = useRouter();
  const [itens, setItens] = useState<Lead[]>(inicial);
  useEffect(() => setItens(inicial), [inicial]);

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Lead | null>(null);
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const conta = useMemo(() => {
    const c: Record<Filtro, number> = { rascunho: 0, enviada: 0, aberta: 0, aceita: 0, fechada: 0, todas: itens.length };
    for (const l of itens) c[situacaoDe(l)]++;
    return c;
  }, [itens]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((l) => filtro === 'todas' || situacaoDe(l) === filtro)
      .filter((l) => !q || [l.name, l.category, l.city, l.phone].some((x) => x?.toLowerCase().includes(q)));
  }, [itens, filtro, busca]);

  async function patch(id: string, corpo: { proposta?: unknown; cnpj?: unknown }) {
    setItens((a) => a.map((l) => (l.id === id ? ({ ...l, ...corpo } as Lead) : l)));
    const r = await fetch('/api/leads/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) setErro('Não consegui salvar a alteração.');
    router.refresh();
  }

  async function copiar(l: Lead) {
    if (!l.linkProposta) return;
    try {
      await navigator.clipboard.writeText(location.origin + l.linkProposta);
      setCopiado(l.id);
      setTimeout(() => setCopiado((c) => (c === l.id ? null : c)), 1800);
    } catch {
      setErro('Não consegui copiar. Abra a proposta e copie o link de lá.');
    }
  }

  async function apagar(l: Lead) {
    if (!confirm(`Apagar a proposta de ${l.name}? O link para o cliente deixa de funcionar.`)) return;
    const r = await fetch('/api/leads/' + encodeURIComponent(l.id), { method: 'DELETE' });
    if (!r.ok) {
      setErro('Não consegui apagar.');
      return;
    }
    setItens((a) => a.filter((x) => x.id !== l.id));
    router.refresh();
  }

  const blocos: { id: Filtro; titulo: string; fundo: string }[] = [
    { id: 'todas', titulo: 'Todas', fundo: 'bg-lavanda' },
    { id: 'enviada', titulo: 'Não abriu ainda', fundo: 'bg-ceu' },
    { id: 'aberta', titulo: 'Abriu', fundo: 'bg-manteiga' },
    { id: 'aceita', titulo: 'Aceitou online', fundo: 'bg-rosa' },
    { id: 'fechada', titulo: 'Fechadas', fundo: 'bg-menta' },
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-tinta px-5 py-4 text-white md:px-6">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold">Proposta sem cadastrar cliente</p>
          <p className="text-[12.5px] font-medium text-white/70">
            Para quem já está conversando por fora: monte o orçamento e mande o link. Não gasta lead do plano.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-extrabold text-tinta transition hover:bg-roxo-100"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          Nova proposta
        </button>
      </div>

      <div role="tablist" aria-label="Filtrar propostas" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {blocos.map(({ id, titulo, fundo }) => {
          const sel = filtro === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setFiltro(id)}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition ${
                sel ? 'bg-tinta text-white' : `${fundo} text-tinta hover:ring-2 hover:ring-inset hover:ring-tinta/20`
              }`}
            >
              {titulo}
              <span className={`rounded-full px-2 py-0.5 text-[11.5px] tabular-nums ${sel ? 'bg-white/20' : 'bg-white/80'}`}>{conta[id]}</span>
            </button>
          );
        })}
        {conta.rascunho > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={filtro === 'rascunho'}
            onClick={() => setFiltro('rascunho')}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition ${
              filtro === 'rascunho' ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta hover:bg-zinc-200'
            }`}
          >
            A montar
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] tabular-nums ${filtro === 'rascunho' ? 'bg-white/20' : 'bg-white'}`}>{conta.rascunho}</span>
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[340px]">
          <span className="sr-only">Procurar proposta</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, ramo, cidade ou telefone…"
            className="min-h-[44px] w-full rounded-full bg-zinc-100 pl-10 pr-4 text-[13.5px] font-medium outline-none placeholder:text-zinc-600 focus:bg-white focus:ring-2 focus:ring-roxo-200"
          />
        </label>
        <span className="ml-auto text-[12.5px] font-semibold text-zinc-500">
          {lista.length} {lista.length === 1 ? 'proposta' : 'propostas'}
        </span>
      </div>

      {erro && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
          {erro}
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="mt-4 rounded-[24px] bg-zinc-50 px-6 py-12 text-center ring-1 ring-inset ring-zinc-200">
          <FileText aria-hidden className="mx-auto h-8 w-8 text-zinc-400" strokeWidth={1.6} />
          <p className="mt-3 text-[15px] font-extrabold">{itens.length ? 'Nenhuma proposta com esse filtro' : 'Nenhuma proposta ainda'}</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-zinc-600">
            {itens.length
              ? 'Troque o filtro acima ou procure por outro nome.'
              : 'Monte a proposta pelo botão de proposta de um lead no painel, ou crie uma avulsa em "Nova proposta".'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-[24px] ring-1 ring-inset ring-zinc-200">
          {lista.map((l) => {
            const sit = situacaoDe(l);
            const v = valoresDe(l);
            const pessoa = l.tipo === 'pessoa';
            return (
              <li
                key={l.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 lg:grid-cols-[auto_minmax(0,1fr)_210px_300px] md:px-5"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${pessoa ? 'bg-rosa' : 'bg-ceu'} text-tinta`}>
                  {pessoa ? <UserRound aria-hidden className="h-5 w-5" strokeWidth={2} /> : <Store aria-hidden className="h-5 w-5" strokeWidth={2} />}
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[14.5px] font-extrabold">{l.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${SELO[sit].classe}`}>
                      {sit === 'aberta' && l.propostaAberturas > 1 ? `Abriu ${l.propostaAberturas}×` : SELO[sit].rotulo}
                    </span>
                    {l.soProposta && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-bold text-zinc-600">Avulsa</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] font-medium text-zinc-500">
                    {[l.category, l.city].filter(Boolean).join(' · ') || (pessoa ? 'Pessoa' : 'Comércio')}
                    {` · ${sit === 'aberta' && l.propostaAbertaEm ? `aberta em ${data(l.propostaAbertaEm)}` : `atualizada em ${data(l.updatedAt)}`}`}
                  </span>
                </span>

                <span className="col-span-2 flex gap-5 lg:col-span-1">
                  {v ? (
                    <>
                      <span>
                        <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Entrada</span>
                        <span className="text-[15px] font-extrabold tabular-nums">{moeda(v.entrada)}</span>
                      </span>
                      <span>
                        <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Mensal</span>
                        <span className="text-[15px] font-extrabold tabular-nums">{v.mensalidade ? moeda(v.mensalidade) : '—'}</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[12.5px] font-semibold text-zinc-500">Ainda sem serviços escolhidos</span>
                  )}
                </span>

                <span className="col-span-2 flex flex-wrap items-center gap-1.5 lg:col-span-1 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => setAberta(l)}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-tinta px-3.5 text-[12.5px] font-bold text-white transition hover:bg-tinta-70"
                  >
                    {sit === 'aceita' || sit === 'fechada' ? <BadgeCheck aria-hidden className="h-4 w-4" /> : <FilePen aria-hidden className="h-4 w-4" />}
                    {l.proposta ? 'Abrir' : 'Montar'}
                  </button>
                  {l.proposta ? (
                    <>
                      <button
                        type="button"
                        onClick={() => copiar(l)}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 text-[12.5px] font-bold text-tinta transition hover:bg-zinc-200"
                      >
                        {copiado === l.id ? <Check aria-hidden className="h-4 w-4" /> : <Link2 aria-hidden className="h-4 w-4" />}
                        {copiado === l.id ? 'Copiado' : 'Copiar link'}
                      </button>
                      <a
                        href={l.linkProposta}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Ver a proposta de ${l.name} como o cliente vê`}
                        title="Ver como o cliente vê"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-tinta transition hover:bg-zinc-200"
                      >
                        <Eye aria-hidden className="h-4 w-4" />
                      </a>
                    </>
                  ) : null}
                  {l.soProposta && (
                    <button
                      type="button"
                      onClick={() => apagar(l)}
                      aria-label={`Apagar a proposta de ${l.name}`}
                      title="Apagar"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-tinta transition hover:bg-red-100 hover:text-red-800"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {criando && (
        <NovaProposta
          aoFechar={() => setCriando(false)}
          aoCriar={(lead) => {
            setCriando(false);
            setItens((a) => [lead, ...a]);
            setFiltro('todas');
            setAberta(lead);
          }}
        />
      )}

      {aberta && (
        <PropostaModal
          lead={aberta}
          linkProposta={aberta.linkProposta || ''}
          aoFechar={() => setAberta(null)}
          aoSalvar={async (proposta) => {
            await patch(aberta.id, { proposta });
            setAberta((a) => (a ? { ...a, proposta } : a));
          }}
          aoSalvarCnpj={async (cnpj) => {
            await patch(aberta.id, { cnpj });
            setAberta((a) => (a ? ({ ...a, cnpj } as Lead) : a));
          }}
        />
      )}
    </div>
  );
}

/** os poucos dados que a proposta precisa: para quem é e, se quiser, o WhatsApp */
function NovaProposta({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (lead: Lead) => void }) {
  const [tipo, setTipo] = useState<'comercio' | 'pessoa'>('comercio');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome, categoria, telefone, cidade }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'Não consegui criar a proposta.');
      aoCriar(d.lead as Lead);
    } catch (err) {
      setErro(String((err as Error).message));
      setSalvando(false);
    }
  }

  const campo = 'min-h-[44px] w-full rounded-full border border-zinc-300 px-4 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const rotulo = 'mb-1 block text-[13px] font-bold text-tinta';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4" onClick={aoFechar}>
      <form
        onSubmit={criar}
        className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">Nova proposta</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">Sem cadastrar cliente. Em seguida você escolhe os serviços.</p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full px-2 py-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {erro && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">{erro}</div>
          )}

          <div role="radiogroup" aria-label="Para quem é" className="mb-4 grid grid-cols-2 gap-2">
            {([
              { v: 'comercio', r: 'Comércio', Icone: Store },
              { v: 'pessoa', r: 'Pessoa', Icone: UserRound },
            ] as const).map(({ v, r, Icone }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={tipo === v}
                onClick={() => setTipo(v)}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-full text-[13.5px] font-bold transition ${
                  tipo === v ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta hover:bg-zinc-200'
                }`}
              >
                <Icone aria-hidden className="h-4 w-4" />
                {r}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className={rotulo} htmlFor="np-nome">Para quem é a proposta *</label>
            <input
              id="np-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              className={campo}
              placeholder={tipo === 'pessoa' ? 'Mariana Souza' : 'Barbearia do Zé'}
            />
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="np-ramo">{tipo === 'pessoa' ? 'Profissão' : 'Ramo'}</label>
              <input id="np-ramo" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo} placeholder={tipo === 'pessoa' ? 'Psicóloga' : 'Barbearia'} />
            </div>
            <div>
              <label className={rotulo} htmlFor="np-cidade">Cidade</label>
              <input id="np-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className={campo} placeholder="Belo Horizonte" />
            </div>
          </div>
          <div>
            <label className={rotulo} htmlFor="np-fone">WhatsApp</label>
            <input id="np-fone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={campo} placeholder="(31) 99999-0000" inputMode="tel" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-[44px] rounded-full border border-zinc-300 px-4 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !nome.trim()}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-tinta px-5 text-[13px] font-semibold text-white transition hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            {salvando ? 'Criando…' : 'Montar proposta'}
            {!salvando && <ArrowUpRight aria-hidden className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
