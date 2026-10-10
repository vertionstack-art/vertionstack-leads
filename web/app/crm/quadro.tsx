'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, GripVertical, MapPin, MessageCircle, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2, X,
} from 'lucide-react';
import type { Card, Cor, Etapa, Quadro } from '@/lib/crm';
import type { Status } from '@/lib/db';

const FUNDO: Record<Cor, string> = {
  zinco: 'bg-zinc-100',
  ceu: 'bg-ceu',
  lavanda: 'bg-lavanda',
  manteiga: 'bg-manteiga',
  rosa: 'bg-rosa',
  menta: 'bg-menta',
};
const NOME_COR: Record<Cor, string> = {
  zinco: 'Cinza', ceu: 'Azul', lavanda: 'Lilás', manteiga: 'Amarelo', rosa: 'Rosa', menta: 'Verde',
};
const SITUACAO: Record<Status, string> = {
  novo: 'Novo (ainda não abordado)',
  contatado: 'Contatado',
  negociando: 'Negociando',
  fechado: 'Fechado (venda ganha)',
  descartado: 'Descartado (perdido)',
};
const TEMP: Record<Card['temperatura'], { rotulo: string; ponto: string }> = {
  quente: { rotulo: 'Quente', ponto: 'bg-red-500' },
  morno: { rotulo: 'Morno', ponto: 'bg-amber-400' },
  frio: { rotulo: 'Frio', ponto: 'bg-violet-400' },
};

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function diasDesde(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

async function chamar(corpo: Record<string, unknown>): Promise<{ ok: boolean; erro?: string; id?: string }> {
  try {
    const r = await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    return await r.json();
  } catch {
    return { ok: false, erro: 'Falha de rede. Confira a internet.' };
  }
}

export default function QuadroCrm({ inicial, tetoFunis }: { inicial: Quadro; tetoFunis: number }) {
  const [q, setQ] = useState<Quadro>(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [adicionarEm, setAdicionarEm] = useState<Etapa | null>(null);
  const [editandoEtapas, setEditandoEtapas] = useState(false);
  const [menuFunil, setMenuFunil] = useState(false);
  const [nomeando, setNomeando] = useState<'novo' | 'renomear' | null>(null);

  const funil = q.funis.find((f) => f.id === q.funilId)!;
  const porEtapa = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const e of funil.etapas) m.set(e.id, []);
    for (const c of q.cards) m.get(c.etapaId)?.push(c);
    for (const lista of m.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [q.cards, funil.etapas]);

  const situacaoDe = (etapaId: string) => funil.etapas.find((e) => e.id === etapaId)?.situacao;
  const emAberto = q.cards.filter((c) => !['fechado', 'descartado'].includes(situacaoDe(c.etapaId) || ''));
  const ganhos = q.cards.filter((c) => situacaoDe(c.etapaId) === 'fechado');

  async function recarregar(funilId = q.funilId) {
    try {
      const r = await fetch('/api/crm?funil=' + funilId).then((x) => x.json());
      if (r.ok) setQ({ funis: r.funis, funilId: r.funilId, cards: r.cards });
    } catch {
      setAviso('Não consegui atualizar o quadro.');
    }
  }

  async function mover(cardId: string, etapaId: string, antesDe: string | null) {
    const lista = (porEtapa.get(etapaId) || []).filter((c) => c.id !== cardId);
    let ordem: number;
    const i = antesDe ? lista.findIndex((c) => c.id === antesDe) : -1;
    if (i === -1) ordem = (lista.at(-1)?.ordem ?? Date.now() / 1000) + 1;
    else ordem = i === 0 ? lista[0].ordem - 1 : (lista[i - 1].ordem + lista[i].ordem) / 2;

    const antes = q;
    setQ({
      ...q,
      cards: q.cards.map((c) =>
        c.id === cardId ? { ...c, etapaId, ordem, etapaEm: c.etapaId === etapaId ? c.etapaEm : new Date().toISOString() } : c,
      ),
    });
    const r = await chamar({ acao: 'mover', leads: [cardId], etapa: etapaId, ordem });
    if (!r.ok) {
      setQ(antes);
      setAviso(r.erro || 'Não consegui mover o card.');
    }
  }

  async function tirar(card: Card) {
    const antes = q;
    setQ({ ...q, cards: q.cards.filter((c) => c.id !== card.id) });
    const r = await chamar({ acao: 'tirar', lead: card.id });
    if (!r.ok) {
      setQ(antes);
      setAviso(r.erro || 'Não consegui tirar o card.');
    }
  }

  async function apagarFunil() {
    setMenuFunil(false);
    if (!confirm(`Apagar o funil "${funil.nome}"? Os leads continuam no painel, só saem deste quadro.`)) return;
    const r = await chamar({ acao: 'apagarFunil', funil: funil.id });
    if (!r.ok) return setAviso(r.erro || 'Não consegui apagar.');
    await recarregar(q.funis.find((f) => f.id !== funil.id)!.id);
  }

  return (
    <div className="mt-7">
      {/* ---------------------------------------------------- funis */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-full bg-zinc-100 p-1">
          {q.funis.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => recarregar(f.id)}
              aria-pressed={f.id === q.funilId}
              className={`min-h-[36px] rounded-full px-4 text-[13px] font-bold transition-colors ${
                f.id === q.funilId ? 'bg-tinta text-white' : 'text-zinc-600 hover:text-tinta'
              }`}
            >
              {f.nome} <span className="ml-1 font-semibold opacity-60 tabular-nums">{f.cards}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (q.funis.length >= tetoFunis ? setAviso(tetoFunis === 1 ? 'O teste grátis tem 1 funil. No Basic você cria até 5.' : `Seu plano permite até ${tetoFunis} funis.`) : setNomeando('novo'))}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-3.5 text-[12.5px] font-bold text-zinc-600 transition-colors hover:border-tinta hover:text-tinta"
        >
          <Plus aria-hidden className="h-4 w-4" /> Novo funil
        </button>
        <div className="relative ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setEditandoEtapas(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-tinta-70"
          >
            <Settings2 aria-hidden className="h-4 w-4" /> Editar etapas
          </button>
          <button
            type="button"
            aria-label="Mais opções do funil"
            aria-expanded={menuFunil}
            onClick={() => setMenuFunil(!menuFunil)}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-zinc-200 hover:border-zinc-400"
          >
            <MoreHorizontal aria-hidden className="h-4 w-4" />
          </button>
          {menuFunil && (
            <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_rgba(11,11,15,0.16)] ring-1 ring-zinc-200">
              <button type="button" onClick={() => { setMenuFunil(false); setNomeando('renomear'); }} className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                <Pencil aria-hidden className="h-4 w-4 text-zinc-500" /> Renomear funil
              </button>
              {q.funis.length > 1 && (
                <button type="button" onClick={apagarFunil} className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold text-red-700 hover:bg-red-50">
                  <Trash2 aria-hidden className="h-4 w-4" /> Apagar funil
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {aviso && (
        <p role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-zinc-100 px-4 py-3 text-[13px] font-semibold">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </p>
      )}

      {/* --------------------------------------------------- resumo */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { rotulo: 'Cards no funil', valor: String(q.cards.length) },
          { rotulo: 'Em andamento', valor: String(emAberto.length) },
          { rotulo: 'Em negociação', valor: reais(emAberto.reduce((s, c) => s + c.entrada, 0)) },
          { rotulo: 'Ganhos neste funil', valor: reais(ganhos.reduce((s, c) => s + c.entrada, 0)) },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-[20px] bg-zinc-50 px-4 py-3.5">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-zinc-500">{k.rotulo}</p>
            <p className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] tabular-nums">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* --------------------------------------------------- quadro */}
      <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-4 md:-mx-9 md:px-9">
        <div className="flex min-w-max gap-3.5">
          {funil.etapas.map((etapa) => {
            const cards = porEtapa.get(etapa.id) || [];
            const soma = cards.reduce((s, c) => s + c.entrada, 0);
            return (
              <section
                key={etapa.id}
                aria-label={etapa.nome}
                onDragOver={(e) => { e.preventDefault(); setSobre(etapa.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) mover(id, etapa.id, null);
                }}
                className={`flex w-[284px] shrink-0 flex-col rounded-[22px] p-2.5 transition-shadow ${FUNDO[etapa.cor]} ${
                  sobre === etapa.id ? 'ring-2 ring-inset ring-tinta' : ''
                }`}
              >
                <header className="flex items-start justify-between gap-2 px-1.5 pb-2.5 pt-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-extrabold">
                      {etapa.nome} <span className="ml-0.5 font-bold text-tinta/50 tabular-nums">{cards.length}</span>
                    </h2>
                    <p className="text-[11.5px] font-semibold text-tinta/55 tabular-nums">{soma ? reais(soma) : '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdicionarEm(etapa)}
                    aria-label={`Adicionar leads em ${etapa.nome}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 transition-colors hover:bg-white"
                  >
                    <Plus aria-hidden className="h-4 w-4" />
                  </button>
                </header>

                <ol className="flex min-h-[120px] flex-1 flex-col gap-2">
                  {cards.map((card) => (
                    <CardCrm
                      key={card.id}
                      card={card}
                      etapas={funil.etapas}
                      arrastando={arrastando === card.id}
                      aoComecar={() => setArrastando(card.id)}
                      aoTerminar={() => { setArrastando(null); setSobre(null); }}
                      aoSoltarAntes={(id) => mover(id, etapa.id, card.id)}
                      aoMover={(etapaId) => mover(card.id, etapaId, null)}
                      aoTirar={() => tirar(card)}
                    />
                  ))}
                  {!cards.length && (
                    <li className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-tinta/10 px-4 py-6 text-center text-[12px] font-semibold text-tinta/45">
                      Arraste um card para cá ou use o +
                    </li>
                  )}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      {adicionarEm && (
        <ModalAdicionar
          funilId={funil.id}
          etapa={adicionarEm}
          aoFechar={() => setAdicionarEm(null)}
          aoAdicionar={async (ids) => {
            const r = await chamar({ acao: 'mover', leads: ids, etapa: adicionarEm.id });
            if (!r.ok) return r.erro || 'Não consegui adicionar.';
            setAdicionarEm(null);
            await recarregar();
            return null;
          }}
        />
      )}

      {editandoEtapas && (
        <ModalEtapas
          etapas={funil.etapas}
          contagem={(id) => porEtapa.get(id)?.length ?? 0}
          aoFechar={() => setEditandoEtapas(false)}
          aoSalvar={async (etapas) => {
            const r = await chamar({ acao: 'salvarEtapas', funil: funil.id, etapas });
            if (!r.ok) return r.erro || 'Não consegui salvar.';
            setEditandoEtapas(false);
            await recarregar();
            return null;
          }}
        />
      )}

      {nomeando && (
        <ModalNome
          titulo={nomeando === 'novo' ? 'Novo funil' : 'Renomear funil'}
          inicial={nomeando === 'novo' ? '' : funil.nome}
          dica={nomeando === 'novo' ? 'Ele já nasce com as etapas padrão; você ajusta depois em Editar etapas.' : undefined}
          aoFechar={() => setNomeando(null)}
          aoSalvar={async (nome) => {
            const r =
              nomeando === 'novo'
                ? await chamar({ acao: 'criarFunil', nome })
                : await chamar({ acao: 'renomearFunil', funil: funil.id, nome });
            if (!r.ok) return r.erro || 'Não consegui salvar.';
            setNomeando(null);
            await recarregar(nomeando === 'novo' && r.id ? r.id : funil.id);
            return null;
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- card

function CardCrm({
  card, etapas, arrastando, aoComecar, aoTerminar, aoSoltarAntes, aoMover, aoTirar,
}: {
  card: Card;
  etapas: Etapa[];
  arrastando: boolean;
  aoComecar: () => void;
  aoTerminar: () => void;
  aoSoltarAntes: (id: string) => void;
  aoMover: (etapaId: string) => void;
  aoTirar: () => void;
}) {
  const t = TEMP[card.temperatura];
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', card.id); e.dataTransfer.effectAllowed = 'move'; aoComecar(); }}
      onDragEnd={aoTerminar}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData('text/plain');
        if (id && id !== card.id) aoSoltarAntes(id);
        aoTerminar();
      }}
      className={`group cursor-grab rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(11,11,15,0.06)] transition-opacity active:cursor-grabbing ${
        arrastando ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical aria-hidden className="mt-0.5 hidden h-4 w-4 shrink-0 text-zinc-300 md:block" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold leading-snug">{card.nome}</p>
          <p className="mt-0.5 truncate text-[12px] text-zinc-500">
            {[card.categoria, card.cidade].filter(Boolean).join(' · ') || 'Sem categoria'}
          </p>
        </div>
        <button
          type="button"
          onClick={aoTirar}
          aria-label={`Tirar ${card.nome} do funil`}
          title="Tirar do funil (o lead continua no painel)"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 opacity-100 transition-opacity hover:bg-zinc-100 hover:text-tinta md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${t.ponto}`} />
          {t.rotulo}
        </span>
        {card.entrada > 0 && <span className="tabular-nums text-tinta">{reais(card.entrada)}{card.mensalidade > 0 && ` + ${reais(card.mensalidade)}/mês`}</span>}
        <span suppressHydrationWarning>{diasDesde(card.etapaEm)}</span>
      </div>

      {card.notas && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">{card.notas}</p>}

      <div className="mt-3 flex items-center gap-1.5">
        {card.whatsapp && (
          <a
            href={`https://wa.me/${card.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chamar ${card.nome} no WhatsApp`}
            title="Abrir no WhatsApp"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-menta text-emerald-950 hover:brightness-95"
          >
            <MessageCircle aria-hidden className="h-3.5 w-3.5" />
          </a>
        )}
        {card.mapsUrl && (
          <a
            href={card.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${card.nome} no Google Maps`}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:text-tinta"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5" />
          </a>
        )}
        <label className="ml-auto min-w-0 flex-1">
          <span className="sr-only">Mover {card.nome} para</span>
          <select
            value={card.etapaId}
            onChange={(e) => aoMover(e.target.value)}
            className="w-full cursor-pointer truncate rounded-full bg-zinc-100 px-2.5 py-1.5 text-[11.5px] font-bold text-zinc-700 outline-none hover:bg-zinc-200"
          >
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
      </div>
      {card.responsavel && <p className="mt-2 text-[11px] font-semibold text-zinc-400">com {card.responsavel}</p>}
    </li>
  );
}

// ----------------------------------------------------------- modais

function Moldura({ titulo, aoFechar, children, largura = 'max-w-[520px]' }: { titulo: string; aoFechar: () => void; children: React.ReactNode; largura?: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-3 md:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') aoFechar(); }}
    >
      <div className={`max-h-[88vh] w-full ${largura} overflow-y-auto rounded-[26px] bg-white p-6`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{titulo}</h2>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalNome({ titulo, inicial, dica, aoFechar, aoSalvar }: {
  titulo: string; inicial: string; dica?: string; aoFechar: () => void; aoSalvar: (nome: string) => Promise<string | null>;
}) {
  const [nome, setNome] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <Moldura titulo={titulo} aoFechar={aoFechar} largura="max-w-[420px]">
      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setErro(await aoSalvar(nome.trim()));
          setOcupado(false);
        }}
      >
        <label className="text-[13px] font-bold" htmlFor="nome-funil">Nome do funil</label>
        <input
          id="nome-funil"
          autoFocus
          value={nome}
          maxLength={40}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Clínicas de Palmas"
          className="mt-1.5 w-full rounded-full border border-zinc-200 px-4 py-2.5 text-[14px] outline-none focus:border-tinta"
        />
        {dica && <p className="mt-2 text-[12.5px] text-zinc-500">{dica}</p>}
        {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{erro}</p>}
        <button
          type="submit"
          disabled={ocupado || !nome.trim()}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-full bg-tinta text-[13.5px] font-bold text-white hover:bg-tinta-70 disabled:opacity-50"
        >
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Moldura>
  );
}

interface Candidato { id: string; nome: string; categoria: string | null; cidade: string | null; status: Status; funil: string | null }

function ModalAdicionar({ funilId, etapa, aoFechar, aoAdicionar }: {
  funilId: string; etapa: Etapa; aoFechar: () => void; aoAdicionar: (ids: string[]) => Promise<string | null>;
}) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Candidato[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iniciou = useRef(false);

  async function buscar(texto: string) {
    try {
      const r = await fetch(`/api/crm?candidatos=1&funil=${funilId}&q=${encodeURIComponent(texto)}`).then((x) => x.json());
      setLista(r.ok ? r.lista : []);
    } catch {
      setLista([]);
    }
  }
  if (!iniciou.current) {
    iniciou.current = true;
    buscar('');
  }

  return (
    <Moldura titulo={`Adicionar em “${etapa.nome}”`} aoFechar={aoFechar}>
      <div className="relative mt-4">
        <Search aria-hidden className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          autoFocus
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            if (espera.current) clearTimeout(espera.current);
            const v = e.target.value;
            espera.current = setTimeout(() => buscar(v), 250);
          }}
          placeholder="Nome, nicho, cidade ou telefone"
          aria-label="Buscar leads"
          className="w-full rounded-full bg-zinc-100 py-2.5 pl-10 pr-4 text-[14px] outline-none focus:ring-2 focus:ring-tinta"
        />
      </div>
      <ul className="mt-3 max-h-[46vh] space-y-1 overflow-y-auto">
        {lista === null && <li className="py-6 text-center text-[13px] text-zinc-500">Carregando…</li>}
        {lista?.length === 0 && <li className="py-6 text-center text-[13px] text-zinc-500">Nenhum lead encontrado fora deste funil.</li>}
        {lista?.map((c) => {
          const on = marcados.has(c.id);
          return (
            <li key={c.id}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 ${on ? 'bg-lavanda' : 'hover:bg-zinc-50'}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const n = new Set(marcados);
                    if (on) n.delete(c.id);
                    else n.add(c.id);
                    setMarcados(n);
                  }}
                  className="h-4 w-4 accent-[#0b0b0f]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{c.nome}</span>
                  <span className="block truncate text-[12px] text-zinc-500">
                    {[c.categoria, c.cidade].filter(Boolean).join(' · ')}
                    {c.funil && ` · hoje em “${c.funil}”`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{erro}</p>}
      <button
        type="button"
        disabled={!marcados.size || ocupado}
        onClick={async () => {
          setOcupado(true);
          setErro(await aoAdicionar([...marcados]));
          setOcupado(false);
        }}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full bg-tinta text-[13.5px] font-bold text-white hover:bg-tinta-70 disabled:opacity-40"
      >
        {ocupado ? 'Adicionando…' : marcados.size ? `Adicionar ${marcados.size} ${marcados.size === 1 ? 'lead' : 'leads'}` : 'Escolha os leads'}
      </button>
    </Moldura>
  );
}

interface EtapaRascunho { id?: string; chave: string; nome: string; cor: Cor; situacao: Status }

function ModalEtapas({ etapas, contagem, aoFechar, aoSalvar }: {
  etapas: Etapa[]; contagem: (id: string) => number; aoFechar: () => void; aoSalvar: (e: Omit<EtapaRascunho, 'chave'>[]) => Promise<string | null>;
}) {
  const [lista, setLista] = useState<EtapaRascunho[]>(etapas.map((e) => ({ ...e, chave: e.id })));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const mudar = (i: number, p: Partial<EtapaRascunho>) => setLista(lista.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const trocar = (i: number, j: number) => {
    const n = [...lista];
    [n[i], n[j]] = [n[j], n[i]];
    setLista(n);
  };
  const somem = etapas.filter((e) => !lista.some((x) => x.id === e.id)).reduce((s, e) => s + contagem(e.id), 0);

  return (
    <Moldura titulo="Etapas do funil" aoFechar={aoFechar} largura="max-w-[640px]">
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
        A situação diz o que a etapa significa para o painel e o Financeiro. Uma etapa “Fechado” conta o cliente como venda
        no mês em que o card chegou nela.
      </p>
      <ol className="mt-5 space-y-2.5">
        {lista.map((e, i) => (
          <li key={e.chave} className={`rounded-[20px] p-3 ${FUNDO[e.cor]}`}>
            <div className="flex items-center gap-2">
              <input
                value={e.nome}
                maxLength={30}
                onChange={(ev) => mudar(i, { nome: ev.target.value })}
                aria-label={`Nome da etapa ${i + 1}`}
                className="min-w-0 flex-1 rounded-full bg-white px-3.5 py-2 text-[13.5px] font-bold outline-none focus:ring-2 focus:ring-tinta"
              />
              <button type="button" disabled={i === 0} onClick={() => trocar(i, i - 1)} aria-label="Subir etapa" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 hover:bg-white disabled:opacity-30">
                <ArrowUp aria-hidden className="h-4 w-4" />
              </button>
              <button type="button" disabled={i === lista.length - 1} onClick={() => trocar(i, i + 1)} aria-label="Descer etapa" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 hover:bg-white disabled:opacity-30">
                <ArrowDown aria-hidden className="h-4 w-4" />
              </button>
              <button type="button" disabled={lista.length <= 2} onClick={() => setLista(lista.filter((_, j) => j !== i))} aria-label={`Apagar etapa ${e.nome}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-red-700 hover:bg-white disabled:opacity-30">
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3 px-1">
              <div className="flex gap-1.5" role="radiogroup" aria-label="Cor">
                {(Object.keys(FUNDO) as Cor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={e.cor === c}
                    aria-label={NOME_COR[c]}
                    onClick={() => mudar(i, { cor: c })}
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${FUNDO[c]} ring-1 ring-tinta/15 ${e.cor === c ? 'ring-2 ring-tinta' : ''}`}
                  >
                    {e.cor === c && <Check aria-hidden className="h-3 w-3" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <label className="ml-auto flex items-center gap-2 text-[12px] font-semibold text-tinta/70">
                Conta como
                <select
                  value={e.situacao}
                  onChange={(ev) => mudar(i, { situacao: ev.target.value as Status })}
                  className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-tinta outline-none"
                >
                  {(Object.keys(SITUACAO) as Status[]).map((s) => <option key={s} value={s}>{SITUACAO[s]}</option>)}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={lista.length >= 12}
        onClick={() => setLista([...lista, { chave: 'nova-' + Math.random().toString(36).slice(2), nome: 'Nova etapa', cor: 'zinco', situacao: 'negociando' }])}
        className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-4 text-[12.5px] font-bold text-zinc-600 hover:border-tinta hover:text-tinta disabled:opacity-40"
      >
        <Plus aria-hidden className="h-4 w-4" /> Adicionar etapa
      </button>
      {somem > 0 && (
        <p className="mt-4 rounded-2xl bg-manteiga px-4 py-3 text-[12.5px] font-semibold">
          {somem} {somem === 1 ? 'card está' : 'cards estão'} em etapas que você apagou. Ao salvar, {somem === 1 ? 'ele vai' : 'eles vão'} para a etapa que ficava logo antes.
        </p>
      )}
      {erro && <p role="alert" className="mt-3 text-[12.5px] font-semibold text-red-700">{erro}</p>}
      <button
        type="button"
        disabled={ocupado || lista.some((e) => !e.nome.trim())}
        onClick={async () => {
          setOcupado(true);
          setErro(await aoSalvar(lista.map(({ id, nome, cor, situacao }) => ({ id, nome: nome.trim(), cor, situacao }))));
          setOcupado(false);
        }}
        className="mt-5 flex min-h-[46px] w-full items-center justify-center rounded-full bg-tinta text-[13.5px] font-bold text-white hover:bg-tinta-70 disabled:opacity-40"
      >
        {ocupado ? 'Salvando…' : 'Salvar etapas'}
      </button>
    </Moldura>
  );
}
