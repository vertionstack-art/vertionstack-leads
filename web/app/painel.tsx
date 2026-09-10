'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lead, Status } from '@/lib/db';
import type { WebsiteKind } from '@/lib/classify';

// --------------------------------------------------------- constantes

const TIPOS: { kind: WebsiteKind; rotulo: string; classe: string }[] = [
  { kind: 'none', rotulo: 'Sem site', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { kind: 'social', rotulo: 'Só rede social', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { kind: 'marketplace', rotulo: 'Só marketplace', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { kind: 'weak', rotulo: 'Site fraco', classe: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { kind: 'site', rotulo: 'Tem site', classe: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
];

const STATUS: { valor: Status; rotulo: string; classe: string }[] = [
  { valor: 'novo', rotulo: 'Novo', classe: 'bg-white text-zinc-700 ring-zinc-300' },
  { valor: 'contatado', rotulo: 'Contatado', classe: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { valor: 'negociando', rotulo: 'Negociando', classe: 'bg-roxo-100 text-roxo-800 ring-roxo-300' },
  { valor: 'fechado', rotulo: 'Fechado', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { valor: 'descartado', rotulo: 'Descartado', classe: 'bg-zinc-100 text-zinc-500 ring-zinc-200' },
];

const PAGINA = 100;

/** como cada resultado da verificação aparece na tabela */
const SITE_STATUS: Record<string, { rotulo: string; classe: string; bom: boolean }> = {
  ok:             { rotulo: 'no ar',        classe: 'text-zinc-500',                         bom: true },
  bloqueado:      { rotulo: 'não checado',  classe: 'text-zinc-400',                         bom: true },
  sem_https:      { rotulo: 'sem HTTPS',    classe: 'text-amber-700 font-medium',            bom: false },
  em_construcao:  { rotulo: 'site vazio',   classe: 'text-emerald-700 font-medium',          bom: false },
  nao_encontrado: { rotulo: 'site com erro',classe: 'text-emerald-700 font-medium',          bom: false },
  fora_do_ar:     { rotulo: 'FORA DO AR',   classe: 'text-emerald-700 font-semibold',        bom: false },
  virou_social:   { rotulo: 'vai p/ social',classe: 'text-emerald-700 font-medium',          bom: false },
  certificado_vencido: { rotulo: 'certificado vencido', classe: 'text-emerald-700 font-medium', bom: false },
};

// ------------------------------------------------------------- utils

/** transforma "(31) 99999-9999" no formato que o WhatsApp entende */
function linkWhatsApp(telefone: string | null): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith('55') ? digitos : '55' + digitos;
  return `https://wa.me/${comPais}`;
}

function tipoDe(kind: WebsiteKind) {
  return TIPOS.find((t) => t.kind === kind) || TIPOS[4];
}

// ------------------------------------------------------------ pedaços

function Selo({ children, classe }: { children: React.ReactNode; classe: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${classe}`}>
      {children}
    </span>
  );
}

function Cartao({
  numero, rotulo, destaque, ativo, onClick,
}: {
  numero: number; rotulo: string; destaque?: boolean; ativo?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        ativo
          ? 'border-roxo-600 bg-roxo-50 ring-2 ring-roxo-200'
          : 'border-zinc-200 bg-white hover:border-roxo-300'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`text-2xl font-semibold tabular-nums ${destaque ? 'text-roxo-700' : 'text-tinta'}`}>
        {numero.toLocaleString('pt-BR')}
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">{rotulo}</div>
    </button>
  );
}

// ------------------------------------------------------------- tela

export default function Painel({ semBanco, semSenha }: { semBanco: boolean; semSenha: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState<Record<string, number>>({});
  const [cidades, setCidades] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [buscaDebounce, setBuscaDebounce] = useState('');
  const [kinds, setKinds] = useState<WebsiteKind[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<Status[]>([]);
  const [cidade, setCidade] = useState('');
  const [categoria, setCategoria] = useState('');
  const [comTelefone, setComTelefone] = useState(false);
  const [siteQuebrado, setSiteQuebrado] = useState(false);
  const [ordem, setOrdem] = useState<'recentes' | 'nome' | 'avaliacoes'>('recentes');
  const [pagina, setPagina] = useState(0);

  const [verificando, setVerificando] = useState(false);
  const [progressoVerif, setProgressoVerif] = useState<{ feitos: number; faltam: number; achados: number } | null>(null);
  const [faltamVerif, setFaltamVerif] = useState(0);

  const [notaAberta, setNotaAberta] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);

  // a busca só dispara depois que você para de digitar
  useEffect(() => {
    const t = setTimeout(() => { setBuscaDebounce(busca); setPagina(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (buscaDebounce) p.set('q', buscaDebounce);
    if (kinds.length) p.set('kind', kinds.join(','));
    if (statusFiltro.length) p.set('status', statusFiltro.join(','));
    if (cidade) p.set('city', cidade);
    if (categoria) p.set('category', categoria);
    if (comTelefone) p.set('fone', '1');
    if (siteQuebrado) p.set('quebrado', '1');
    p.set('ordem', ordem);
    p.set('limit', String(PAGINA));
    p.set('offset', String(pagina * PAGINA));
    return p.toString();
  }, [buscaDebounce, kinds, statusFiltro, cidade, categoria, comTelefone, siteQuebrado, ordem, pagina]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/leads?' + query, { cache: 'no-store' });
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'Falha ao carregar.');
      setLeads(d.leads);
      setTotal(d.total);
      setResumo(d.resumo);
      setCidades(d.cidades);
      setCategorias(d.categorias);
    } catch (e) {
      setErro(String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }, [query]);

  useEffect(() => { carregar(); }, [carregar]);

  // quantos leads têm site cadastrado que ninguém conferiu ainda
  const contarPendentes = useCallback(async () => {
    try {
      const r = await fetch('/api/leads/verificar', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setFaltamVerif(d.faltam);
    } catch { /* sem drama: o botão apenas não aparece */ }
  }, []);

  useEffect(() => { contarPendentes(); }, [contarPendentes]);

  /**
   * Chama a rota de verificação em rodadas até esvaziar a fila.
   * Cada rodada checa um punhado de sites; fazer tudo numa requisição só
   * estouraria o tempo limite da função na Vercel.
   */
  async function verificarSites() {
    setVerificando(true);
    setProgressoVerif({ feitos: 0, faltam: faltamVerif, achados: 0 });

    let feitos = 0;
    let achados = 0;

    try {
      for (let rodada = 0; rodada < 200; rodada++) {
        const r = await fetch('/api/leads/verificar', { method: 'POST' });
        const d = await r.json();
        if (!d.ok) throw new Error(d.erro || 'Falha ao verificar.');

        feitos += d.verificados;
        achados += d.novasOportunidades || 0;
        setProgressoVerif({ feitos, faltam: d.faltam, achados });
        setFaltamVerif(d.faltam);

        if (!d.verificados || !d.faltam) break;
      }
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message));
    } finally {
      setVerificando(false);
      setTimeout(() => setProgressoVerif(null), 8000);
    }
  }

  // recarrega sozinho enquanto a extensão está mandando dados
  useEffect(() => {
    const t = setInterval(carregar, 20000);
    return () => clearInterval(t);
  }, [carregar]);

  function alternar<T>(lista: T[], set: (v: T[]) => void, valor: T) {
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
    setPagina(0);
  }

  async function salvarPatch(id: string, patch: { status?: Status; notes?: string | null }) {
    setLeads((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } as Lead : l)));
    const r = await fetch('/api/leads/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { setErro('Não consegui salvar a alteração.'); carregar(); }
  }

  async function apagar(id: string, nome: string) {
    if (!confirm(`Apagar "${nome}" da lista?`)) return;
    await fetch('/api/leads/' + encodeURIComponent(id), { method: 'DELETE' });
    setLeads((atual) => atual.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  }

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1400);
  }

  // o servidor já conta as oportunidades pelo is_lead, que a verificação de
  // site também altera; a soma dos tipos ignoraria os sites que caíram
  const quentes = resumo.oportunidades ?? ((resumo.none || 0) + (resumo.social || 0) + (resumo.marketplace || 0) + (resumo.weak || 0));
  const filtroLimpo = !buscaDebounce && !kinds.length && !statusFiltro.length && !cidade && !categoria && !comTelefone && !siteQuebrado;
  const ultimaPagina = (pagina + 1) * PAGINA >= total;

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------ topo */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-roxo-600 ring-4 ring-roxo-100" />
            <div>
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Vertion Leads</h1>
              <p className="text-[11px] leading-tight text-zinc-500">comércios sem site próprio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(faltamVerif > 0 || verificando) && (
              <button
                onClick={verificarSites}
                disabled={verificando}
                title="Abre cada site cadastrado para ver se está mesmo no ar"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:border-emerald-500 disabled:opacity-60"
              >
                {verificando ? 'Conferindo sites…' : `Conferir ${faltamVerif} sites`}
              </button>
            )}
            <a
              href="/extensao"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700"
            >
              Extensão
            </a>
            <a
              href={'/api/leads/export?' + query}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-roxo-400 hover:text-roxo-700"
            >
              Baixar CSV
            </a>
            <button
              onClick={carregar}
              className="rounded-lg bg-roxo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-roxo-700"
            >
              {carregando ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-6">
        {/* --------------------------------------------------- avisos */}
        {semBanco && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            <b>Sem banco de dados.</b> Os leads que chegarem não vão sobreviver a um novo deploy nem a uma pausa
            do servidor. Na Vercel, vá em <em>Storage → Create Database → Neon</em> e conecte ao projeto; a
            variável <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> aparece sozinha.
          </div>
        )}
        {semSenha && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
            <b>Painel sem senha.</b> Qualquer pessoa com o endereço vê seus leads. Crie a variável{' '}
            <code className="rounded bg-red-100 px-1">DASHBOARD_PASSWORD</code> na Vercel.
          </div>
        )}
        {erro && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{erro}</div>
        )}

        {progressoVerif && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            {verificando ? (
              <>
                Conferindo os sites: <b>{progressoVerif.feitos}</b> checados
                {progressoVerif.faltam > 0 && `, ${progressoVerif.faltam} na fila`}.
                {progressoVerif.achados > 0 && (
                  <> Já achei <b>{progressoVerif.achados}</b> que não estão de pé.</>
                )}
              </>
            ) : (
              <>
                Conferi <b>{progressoVerif.feitos}</b> sites.{' '}
                {progressoVerif.achados > 0 ? (
                  <>
                    <b>{progressoVerif.achados}</b> não estavam no ar e viraram oportunidade — eles
                    aparecem como <em>site fora do ar</em>, <em>site vazio</em> ou{' '}
                    <em>vai p/ social</em> na coluna de presença digital.
                  </>
                ) : (
                  'Todos estavam no ar.'
                )}
              </>
            )}
          </div>
        )}

        {/* --------------------------------------------------- resumo */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cartao
            numero={resumo.total || 0}
            rotulo="comércios mapeados"
            ativo={filtroLimpo}
            onClick={() => { setKinds([]); setStatusFiltro([]); setBusca(''); setCidade(''); setCategoria(''); setComTelefone(false); setSiteQuebrado(false); setPagina(0); }}
          />
          <Cartao
            numero={quentes}
            rotulo="oportunidades"
            destaque
            ativo={kinds.length === 4}
            onClick={() => { setKinds(['none', 'social', 'marketplace', 'weak']); setSiteQuebrado(false); setPagina(0); }}
          />
          {TIPOS.slice(0, 4).map((t) => (
            <Cartao
              key={t.kind}
              numero={resumo[t.kind] || 0}
              rotulo={t.rotulo.toLowerCase()}
              ativo={kinds.length === 1 && kinds[0] === t.kind}
              onClick={() => { setKinds(kinds.length === 1 && kinds[0] === t.kind ? [] : [t.kind]); setPagina(0); }}
            />
          ))}
        </div>

        {/* -------------------------------------------------- filtros */}
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone, endereço…"
              className="min-w-[240px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
            />

            <select
              value={cidade}
              onChange={(e) => { setCidade(e.target.value); setPagina(0); }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] outline-none focus:border-roxo-500"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={categoria}
              onChange={(e) => { setCategoria(e.target.value); setPagina(0); }}
              className="max-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-[13px] outline-none focus:border-roxo-500"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={ordem}
              onChange={(e) => { setOrdem(e.target.value as typeof ordem); setPagina(0); }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-[13px] outline-none focus:border-roxo-500"
            >
              <option value="recentes">Mais recentes</option>
              <option value="avaliacoes">Mais avaliados</option>
              <option value="nome">Ordem alfabética</option>
            </select>

            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-700">
              <input
                type="checkbox"
                checked={comTelefone}
                onChange={(e) => { setComTelefone(e.target.checked); setPagina(0); }}
                className="h-4 w-4 accent-roxo-600"
              />
              Só com telefone
            </label>

            {(resumo.site_quebrado ?? 0) > 0 && (
              <label
                className="flex cursor-pointer items-center gap-2 text-[13px] text-emerald-800"
                title="Comércios cujo site cadastrado no Google não está de pé"
              >
                <input
                  type="checkbox"
                  checked={siteQuebrado}
                  onChange={(e) => { setSiteQuebrado(e.target.checked); setPagina(0); }}
                  className="h-4 w-4 accent-emerald-600"
                />
                Site não está de pé <span className="text-emerald-600">({resumo.site_quebrado})</span>
              </label>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
            {TIPOS.map((t) => (
              <button
                key={t.kind}
                onClick={() => alternar(kinds, setKinds, t.kind)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 transition ${
                  kinds.includes(t.kind) ? 'bg-roxo-600 text-white ring-roxo-600' : t.classe + ' ring-inset hover:ring-roxo-300'
                }`}
              >
                {t.rotulo} <span className="opacity-60">{resumo[t.kind] || 0}</span>
              </button>
            ))}
            <span className="mx-2 w-px self-stretch bg-zinc-200" />
            {STATUS.map((s) => (
              <button
                key={s.valor}
                onClick={() => alternar(statusFiltro, setStatusFiltro, s.valor)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 transition ${
                  statusFiltro.includes(s.valor) ? 'bg-tinta text-white ring-tinta' : s.classe + ' ring-inset hover:ring-zinc-400'
                }`}
              >
                {s.rotulo} <span className="opacity-60">{resumo['status_' + s.valor] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------- tabela */}
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Comércio</th>
                  <th className="px-4 py-2.5 font-semibold">Presença digital</th>
                  <th className="px-4 py-2.5 font-semibold">Contato</th>
                  <th className="px-4 py-2.5 font-semibold">Onde fica</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Reputação</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {leads.map((lead) => {
                  const t = tipoDe(lead.websiteKind);
                  const zap = linkWhatsApp(lead.phone);
                  return (
                    <tr key={lead.id} className="align-top transition hover:bg-roxo-50/40">
                      <td className="px-4 py-3">
                        <div className="font-medium leading-snug">{lead.name}</div>
                        {lead.category && <div className="mt-0.5 text-[11.5px] text-zinc-500">{lead.category}</div>}
                        {notaAberta === lead.id ? (
                          <div className="mt-2">
                            <textarea
                              value={rascunho}
                              onChange={(e) => setRascunho(e.target.value)}
                              rows={3}
                              autoFocus
                              placeholder="O que rolou nesse contato…"
                              className="w-full rounded-lg border border-roxo-300 px-2 py-1.5 text-[12px] outline-none focus:ring-2 focus:ring-roxo-100"
                            />
                            <div className="mt-1 flex gap-2">
                              <button
                                onClick={() => { salvarPatch(lead.id, { notes: rascunho }); setNotaAberta(null); }}
                                className="rounded bg-roxo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-roxo-700"
                              >
                                Salvar
                              </button>
                              <button onClick={() => setNotaAberta(null)} className="text-[11px] text-zinc-500 hover:text-zinc-800">
                                cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setNotaAberta(lead.id); setRascunho(lead.notes || ''); }}
                            className="mt-1 block max-w-[260px] truncate text-left text-[11.5px] text-roxo-700 hover:underline"
                          >
                            {lead.notes ? `“${lead.notes}”` : '+ anotação'}
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Selo classe={t.classe}>{t.rotulo}</Selo>
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="mt-1 block max-w-[200px] truncate text-[11.5px] text-zinc-500 hover:text-roxo-700 hover:underline"
                            title={lead.website}
                          >
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        )}
                        {lead.siteStatus && SITE_STATUS[lead.siteStatus] && (
                          <div
                            className={`mt-1 text-[11px] ${SITE_STATUS[lead.siteStatus].classe}`}
                            title={lead.siteDetalhe || ''}
                          >
                            {SITE_STATUS[lead.siteStatus].bom ? '' : '⚠ '}
                            {SITE_STATUS[lead.siteStatus].rotulo}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {lead.phone ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => copiar(lead.phone!, lead.id)}
                              className="text-left font-medium tabular-nums text-zinc-800 hover:text-roxo-700"
                              title="Clique para copiar"
                            >
                              {copiado === lead.id ? 'copiado!' : lead.phone}
                            </button>
                            {zap && (
                              <a
                                href={zap}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-fit rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-zinc-400">sem telefone</span>
                        )}
                      </td>

                      <td className="max-w-[240px] px-4 py-3">
                        <div className="truncate text-zinc-700" title={lead.address || ''}>
                          {lead.address || '—'}
                        </div>
                        {lead.city && <div className="mt-0.5 text-[11.5px] text-zinc-500">{lead.city}</div>}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {lead.rating ? (
                          <>
                            <div className="font-medium tabular-nums">{lead.rating.toFixed(1)}</div>
                            <div className="text-[11px] text-zinc-500">{lead.reviews ?? 0} aval.</div>
                          </>
                        ) : (
                          <span className="text-[12px] text-zinc-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => salvarPatch(lead.id, { status: e.target.value as Status })}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-roxo-500"
                        >
                          {STATUS.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                        </select>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {lead.mapsUrl && (
                          <a
                            href={lead.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11.5px] text-zinc-500 hover:text-roxo-700 hover:underline"
                          >
                            Maps
                          </a>
                        )}
                        <button
                          onClick={() => apagar(lead.id, lead.name)}
                          className="ml-3 text-[11.5px] text-zinc-400 hover:text-red-600"
                        >
                          apagar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!leads.length && !carregando && (
            <div className="px-6 py-16 text-center">
              <p className="text-[15px] font-medium text-zinc-700">
                {resumo.total ? 'Nenhum lead com esses filtros.' : 'Nenhum lead ainda.'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">
                {resumo.total
                  ? 'Afrouxe os filtros acima para ver mais resultados.'
                  : 'Abra a extensão no Google Maps, escolha os tipos de comércio e a cidade, e clique em Iniciar coleta. Os resultados aparecem aqui sozinhos.'}
              </p>
              <p className="mt-4">
                <a href="/extensao" className="text-[13px] font-medium text-roxo-700 underline underline-offset-2 hover:text-roxo-800">
                  Ainda não instalou a extensão? Baixe aqui →
                </a>
              </p>
            </div>
          )}

          {carregando && !leads.length && (
            <div className="px-6 py-16 text-center text-[13px] text-zinc-500">Carregando…</div>
          )}
        </div>

        {/* ------------------------------------------------ paginação */}
        {total > PAGINA && (
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-zinc-500">
              {pagina * PAGINA + 1}–{Math.min((pagina + 1) * PAGINA, total)} de {total.toLocaleString('pt-BR')}
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagina === 0}
                onClick={() => { setPagina((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40 enabled:hover:border-roxo-400"
              >
                Anterior
              </button>
              <button
                disabled={ultimaPagina}
                onClick={() => { setPagina((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40 enabled:hover:border-roxo-400"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
