'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Search, ShieldOff } from 'lucide-react';
import type { PagamentoCentral, Pessoa, Situacao } from '@/lib/central';
import PainelAcessos from './painel-acessos';

interface Receita {
  ativos: { basic: number; pro: number };
  mensalCentavos: number;
  mesCentavos: number;
  mesAnteriorCentavos: number;
  totalCentavos: number;
  cancelamentosAgendados: number;
  cartoesRecusados: number;
}
interface Google {
  chamadas: number;
  comercios: number;
  leads: number;
  teto: number;
  gratis: number;
  custoDolares: number;
}
interface Dados {
  pessoas: Pessoa[];
  receita: Receita;
  google: Google;
  pagamentos: PagamentoCentral[];
  dias: { dia: string; cadastros: number; compras: number; buscas: number }[];
  minhaConta: string;
}

type Aba = 'geral' | 'pessoas' | 'assinantes' | 'vencidos' | 'desistiram' | 'pagamentos' | 'acessos';

const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  assinante: { rotulo: 'Assinante', classe: 'bg-menta text-emerald-950' },
  vencido: { rotulo: 'Não renovou', classe: 'bg-rosa text-red-950' },
  teste: { rotulo: 'No teste', classe: 'bg-ceu text-sky-950' },
  teste_esgotado: { rotulo: 'Teste acabou', classe: 'bg-manteiga text-amber-950' },
  teste_negado: { rotulo: 'Teste negado', classe: 'bg-zinc-200 text-zinc-800' },
  cortesia: { rotulo: 'Cortesia', classe: 'bg-lavanda text-violet-950' },
  bloqueado: { rotulo: 'Bloqueado', classe: 'bg-tinta text-white' },
};

const PLANO: Record<string, string> = { gratis: 'Teste', semanal: '7 dias', basic: 'Basic', pro: 'Pro', cortesia: 'Cortesia', pago: 'Pro' };

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number) => n.toLocaleString('pt-BR');

function data(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
}

function haQuanto(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

function Kpi({ rotulo, valor, detalhe, fundo = 'bg-zinc-50 ring-1 ring-inset ring-zinc-200' }: { rotulo: string; valor: string; detalhe?: string; fundo?: string }) {
  return (
    <div className={`rounded-[22px] p-5 ${fundo}`}>
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] opacity-70">{rotulo}</p>
      <p className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{valor}</p>
      {detalhe && <p className="mt-2 text-[12.5px] font-semibold opacity-70">{detalhe}</p>}
    </div>
  );
}

/** barras dos últimos 30 dias de uma série só; passar o mouse mostra o dia e o número */
function Barras({ titulo, serie, cor }: { titulo: string; serie: { dia: string; n: number }[]; cor: string }) {
  const max = Math.max(1, ...serie.map((s) => s.n));
  const total = serie.reduce((a, s) => a + s.n, 0);
  return (
    <div className="rounded-[22px] border border-zinc-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-extrabold">{titulo}</h3>
        <span className="text-[12.5px] font-bold tabular-nums text-zinc-600">{num(total)} em 30 dias</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label={`${titulo}: ${total} nos últimos 30 dias`}>
        {serie.map((s) => (
          <div key={s.dia} className="group relative flex h-full flex-1 items-end" title={`${data(s.dia + 'T12:00:00')}: ${s.n}`}>
            <div className={`w-full rounded-t-[3px] ${cor}`} style={{ height: s.n ? `${Math.max(6, (s.n / max) * 100)}%` : '2px', opacity: s.n ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-zinc-500">
        <span>{data(serie[0]?.dia + 'T12:00:00')}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

export default function PainelCentral({ meuIp }: { meuIp: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [aba, setAba] = useState<Aba>('geral');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Situacao | 'todas'>('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const d = await fetch('/api/central/contas', { cache: 'no-store' }).then((r) => r.json());
      if (d.ok) setDados(d);
      else setErro(d.erro || 'Não consegui carregar.');
    } catch {
      setErro('Sem conexão.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(chave: string, corpo: Record<string, unknown>, ok: string) {
    setOcupado(chave);
    setAviso(null);
    try {
      const d = await fetch('/api/central/contas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      }).then((r) => r.json());
      if (d.ok) {
        setDados(d);
        setAviso(ok);
      } else setAviso(d.erro || 'Não deu certo.');
    } catch {
      setAviso('Sem conexão.');
    } finally {
      setOcupado(null);
    }
  }

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of dados?.pessoas || []) c[p.situacao] = (c[p.situacao] || 0) + 1;
    return c;
  }, [dados]);

  if (erro) return <p className="m-6 rounded-2xl bg-rosa p-5 font-semibold">{erro}</p>;
  if (!dados) return <div className="m-6 h-40 animate-pulse rounded-[24px] bg-zinc-100" aria-label="Carregando" />;

  const todos = dados.pessoas;
  const assinantes = todos.filter((p) => p.situacao === 'assinante');
  const vencidos = todos.filter((p) => p.situacao === 'vencido');
  const desistiram = todos.filter((p) => p.comprasAbandonadas > 0 && p.situacao !== 'assinante');
  const novos7 = todos.filter((p) => Date.now() - new Date(p.criadoEm).getTime() < 7 * 864e5).length;
  const ativos7 = todos.filter((p) => p.ultimoAcesso && Date.now() - new Date(p.ultimoAcesso).getTime() < 7 * 864e5).length;
  const porPlano = { semanal: 0, basic: 0, pro: 0 };
  for (const p of assinantes) if (p.plano in porPlano) porPlano[p.plano as keyof typeof porPlano]++;
  const usaramBusca = todos.filter((p) => p.buscasTotal > 0 || p.leads > 0).length;
  const iniciaramCompra = todos.filter((p) => p.ultimaTentativa).length;
  const pagaram = todos.filter((p) => p.pagamentos > 0).length;

  const ABAS: { id: Aba; rotulo: string; n?: number }[] = [
    { id: 'geral', rotulo: 'Visão geral' },
    { id: 'pessoas', rotulo: 'Pessoas', n: todos.length },
    { id: 'assinantes', rotulo: 'Assinantes', n: assinantes.length },
    { id: 'vencidos', rotulo: 'Não renovaram', n: vencidos.length },
    { id: 'desistiram', rotulo: 'Desistiram da compra', n: desistiram.length },
    { id: 'pagamentos', rotulo: 'Pagamentos', n: dados.pagamentos.length },
    { id: 'acessos', rotulo: 'Acessos' },
  ];

  const lista = (aba === 'assinantes' ? assinantes : aba === 'vencidos' ? vencidos : aba === 'desistiram' ? desistiram : todos)
    .filter((p) => aba !== 'pessoas' || filtro === 'todas' || p.situacao === filtro)
    .filter((p) => {
      const q = busca.trim().toLowerCase();
      return !q || p.email.toLowerCase().includes(q) || (p.nome || '').toLowerCase().includes(q) || (p.contaNome || '').toLowerCase().includes(q);
    });

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1400px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Central</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">Só você vê esta página. Ela não aparece em nenhum lugar da ferramenta.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={carregar}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-300 px-4 text-[13px] font-bold hover:border-zinc-500"
            >
              <RefreshCw aria-hidden className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <a href="/" className="inline-flex min-h-[40px] items-center rounded-full bg-tinta px-4 text-[13px] font-bold text-white hover:bg-tinta-70">
              Ir para a ferramenta
            </a>
          </div>
        </header>

        <nav className="mt-7 flex flex-wrap gap-1.5 rounded-[20px] bg-zinc-100 p-1.5" aria-label="Seções da central">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setAba(a.id); setBusca(''); }}
              aria-pressed={aba === a.id}
              className={`min-h-[38px] rounded-full px-4 text-[13px] font-bold transition-colors ${aba === a.id ? 'bg-tinta text-white' : 'text-zinc-700 hover:bg-white'}`}
            >
              {a.rotulo} {a.n !== undefined && <span className="ml-0.5 tabular-nums opacity-60">{a.n}</span>}
            </button>
          ))}
        </nav>

        {aviso && (
          <p role="status" className="mt-4 rounded-2xl bg-zinc-100 px-4 py-3 text-[13px] font-semibold ring-1 ring-inset ring-zinc-200">
            {aviso}
          </p>
        )}

        {/* ------------------------------------------------- visão geral */}
        {aba === 'geral' && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi rotulo="Recorrente por mês" valor={brl(dados.receita.mensalCentavos)} detalhe={`${porPlano.basic} Basic · ${porPlano.pro} Pro · ${porPlano.semanal} de 7 dias`} fundo="bg-tinta text-white" />
              <Kpi rotulo="Recebido este mês" valor={brl(dados.receita.mesCentavos)} detalhe={`mês passado ${brl(dados.receita.mesAnteriorCentavos)} · total ${brl(dados.receita.totalCentavos)}`} fundo="bg-menta text-emerald-950" />
              <Kpi rotulo="Pessoas cadastradas" valor={num(todos.length)} detalhe={`${novos7} novas nos últimos 7 dias · ${ativos7} entraram na semana`} fundo="bg-ceu text-sky-950" />
              <Kpi
                rotulo="Busca no Google (mês)"
                valor={`${num(dados.google.chamadas)} / ${num(dados.google.teto)}`}
                detalhe={dados.google.custoDolares > 0 ? `gasto estimado US$ ${dados.google.custoDolares.toFixed(2)}` : 'dentro da faixa grátis · R$ 0'}
                fundo="bg-lavanda text-violet-950"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi rotulo="Assinantes ativos" valor={num(assinantes.length)} />
              <Kpi rotulo="No teste grátis" valor={num(contagem.teste || 0)} detalhe={`${contagem.teste_esgotado || 0} esgotaram · ${contagem.teste_negado || 0} negados`} />
              <Kpi rotulo="Não renovaram" valor={num(vencidos.length)} detalhe={`${dados.receita.cancelamentosAgendados} cancelamento(s) agendado(s)`} />
              <Kpi rotulo="Desistiram da compra" valor={num(desistiram.length)} detalhe="abriram o pagamento e não pagaram" />
              <Kpi rotulo="Cartão recusado" valor={num(dados.receita.cartoesRecusados)} detalhe="na renovação" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Barras titulo="Cadastros por dia" serie={dados.dias.map((d) => ({ dia: d.dia, n: d.cadastros }))} cor="bg-sky-600" />
              <Barras titulo="Compras por dia" serie={dados.dias.map((d) => ({ dia: d.dia, n: d.compras }))} cor="bg-emerald-600" />
              <Barras titulo="Buscas no Google por dia" serie={dados.dias.map((d) => ({ dia: d.dia, n: d.buscas }))} cor="bg-violet-600" />
            </div>

            <div className="rounded-[22px] border border-zinc-200 bg-white p-5">
              <h3 className="text-[14px] font-extrabold">Do cadastro ao pagamento</h3>
              <div className="mt-4 space-y-3">
                {[
                  { rotulo: 'Criaram conta', n: todos.length },
                  { rotulo: 'Buscaram ou cadastraram leads', n: usaramBusca },
                  { rotulo: 'Abriram a página de pagamento', n: iniciaramCompra },
                  { rotulo: 'Pagaram pelo menos uma vez', n: pagaram },
                ].map((e) => (
                  <div key={e.rotulo} className="grid grid-cols-[200px_minmax(0,1fr)_90px] items-center gap-3 text-[13px]">
                    <span className="font-semibold">{e.rotulo}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-tinta" style={{ width: `${todos.length ? (e.n / todos.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-right font-bold tabular-nums">
                      {num(e.n)} <span className="font-semibold text-zinc-500">{todos.length ? Math.round((e.n / todos.length) * 100) : 0}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------ listas de pessoas */}
        {(aba === 'pessoas' || aba === 'assinantes' || aba === 'vencidos' || aba === 'desistiram') && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
              <div className="relative min-w-[240px] flex-1">
                <Search aria-hidden className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por e-mail ou nome"
                  aria-label="Buscar pessoa"
                  className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-[13.5px] outline-none focus:border-tinta"
                />
              </div>
              {aba === 'pessoas' && (
                <div className="flex flex-wrap gap-1.5">
                  {(['todas', 'assinante', 'teste', 'teste_esgotado', 'vencido', 'teste_negado', 'cortesia', 'bloqueado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFiltro(s)}
                      aria-pressed={filtro === s}
                      className={`min-h-[34px] rounded-full px-3 text-[12px] font-bold ring-1 ring-inset ${
                        filtro === s ? 'bg-tinta text-white ring-tinta' : 'bg-white text-tinta ring-zinc-300 hover:ring-zinc-500'
                      }`}
                    >
                      {s === 'todas' ? 'Todas' : SITUACAO[s].rotulo}{' '}
                      <span className="tabular-nums opacity-60">{s === 'todas' ? todos.length : contagem[s] || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 overflow-x-auto rounded-[24px] border border-zinc-200 bg-white">
              <table className="w-full min-w-[1100px] text-left text-[13px]">
                <thead className="bg-zinc-50 text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-600">
                  <tr className="border-b border-zinc-200">
                    <th className="py-3 pl-5 pr-3">Pessoa</th>
                    <th className="px-3 py-3">Situação</th>
                    <th className="px-3 py-3">Plano</th>
                    <th className="px-3 py-3">{aba === 'desistiram' ? 'Tentou comprar' : 'Último acesso'}</th>
                    <th className="px-3 py-3">Uso</th>
                    <th className="px-3 py-3 text-right">Já pagou</th>
                    <th className="px-3 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const s = SITUACAO[p.situacao];
                    const chave = p.contaId || p.userId;
                    const minha = p.contaId === dados.minhaConta;
                    const assunto = encodeURIComponent(
                      p.situacao === 'vencido' ? 'Sentimos sua falta no Vertion Leads' : p.comprasAbandonadas ? 'Ficou alguma dúvida sobre o Vertion Leads?' : 'Vertion Leads',
                    );
                    return (
                      <tr key={p.userId} className="border-b border-zinc-200 align-top last:border-b-0 hover:bg-zinc-50">
                        <td className="py-3.5 pl-5 pr-3">
                          <p className="font-bold">{p.email}</p>
                          <p className="text-[12px] text-zinc-500">
                            {p.nome || '—'} · desde {data(p.criadoEm)}
                            {!p.emailConfirmado && <span className="font-semibold text-amber-700"> · e-mail não confirmado</span>}
                          </p>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold ${s.classe}`}>{s.rotulo}</span>
                          {p.cartaoRecusado && <p className="mt-1 text-[11.5px] font-bold text-red-700">cartão recusado</p>}
                          {p.cancelaEm && <p className="mt-1 text-[11.5px] font-semibold text-zinc-600">cancela em {data(p.cancelaEm)}</p>}
                          {p.testeNegado && <p className="mt-1 text-[11.5px] font-semibold text-zinc-600">teste usado {p.testeNegado}</p>}
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-bold">{PLANO[p.planoGuardado || 'gratis'] || p.planoGuardado}</p>
                          <p className="text-[12px] text-zinc-500">
                            {p.pagoAte ? `${new Date(p.pagoAte) > new Date() ? 'vale até' : 'venceu em'} ${data(p.pagoAte)}` : '—'}
                            {p.forma && ` · ${p.forma === 'pix' ? 'Pix' : 'cartão'}`}
                          </p>
                        </td>
                        <td className="px-3 py-3.5">
                          {aba === 'desistiram' && p.ultimaTentativa ? (
                            <>
                              <p className="font-bold">
                                {PLANO[p.ultimaTentativa.plano] || p.ultimaTentativa.plano} · {p.ultimaTentativa.forma === 'pix' ? 'Pix' : 'cartão'}
                              </p>
                              <p className="text-[12px] text-zinc-500">
                                {haQuanto(p.ultimaTentativa.em)} · {p.comprasAbandonadas} {p.comprasAbandonadas === 1 ? 'tentativa' : 'tentativas'}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold">{haQuanto(p.ultimoAcesso)}</p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] tabular-nums">
                          <p>{num(p.leads)} leads</p>
                          <p className="text-zinc-500">
                            {p.buscasMes} buscas no mês · {p.buscasTotal} no total
                          </p>
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums">
                          <p className="font-bold">{brl(p.totalPagoCentavos)}</p>
                          <p className="text-[12px] text-zinc-500">{p.pagamentos ? `${p.pagamentos}× · último ${data(p.ultimoPagamento)}` : 'nunca'}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          {p.contaId ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <label className="sr-only" htmlFor={`plano-${chave}`}>Plano de {p.email}</label>
                              <select
                                id={`plano-${chave}`}
                                value={p.planoGuardado === 'pago' ? 'pro' : p.planoGuardado || 'gratis'}
                                disabled={ocupado === chave}
                                onChange={(e) => agir(chave, { acao: 'plano', contaId: p.contaId, plano: e.target.value }, `Plano de ${p.email} alterado.`)}
                                className="rounded-full border border-zinc-300 bg-white px-2.5 py-1.5 text-[12px] font-bold"
                              >
                                {Object.entries({ gratis: 'Teste', semanal: '7 dias', basic: 'Basic', pro: 'Pro', cortesia: 'Cortesia' }).map(([v, r]) => (
                                  <option key={v} value={v}>{r}</option>
                                ))}
                              </select>
                              {p.planoGuardado !== 'cortesia' && p.planoGuardado !== 'gratis' && (
                                <>
                                  <button type="button" disabled={ocupado === chave} onClick={() => agir(chave, { acao: 'dias', contaId: p.contaId, dias: 7 }, `+7 dias para ${p.email}.`)} className="rounded-full px-2.5 py-1.5 text-[12px] font-bold ring-1 ring-inset ring-zinc-300 hover:ring-tinta">+7d</button>
                                  <button type="button" disabled={ocupado === chave} onClick={() => agir(chave, { acao: 'dias', contaId: p.contaId, dias: 30 }, `+30 dias para ${p.email}.`)} className="rounded-full px-2.5 py-1.5 text-[12px] font-bold ring-1 ring-inset ring-zinc-300 hover:ring-tinta">+30d</button>
                                </>
                              )}
                              {p.testeNegado && (
                                <button type="button" disabled={ocupado === chave} onClick={() => agir(chave, { acao: 'liberar_teste', contaId: p.contaId }, `Teste liberado para ${p.email}.`)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold ring-1 ring-inset ring-zinc-300 hover:ring-tinta">
                                  <ShieldOff aria-hidden className="h-3.5 w-3.5" /> Liberar teste
                                </button>
                              )}
                              <a href={`mailto:${p.email}?subject=${assunto}`} aria-label={`Mandar e-mail para ${p.email}`} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full ring-1 ring-inset ring-zinc-300 hover:ring-tinta">
                                <Mail aria-hidden className="h-3.5 w-3.5" />
                              </a>
                              {!minha && (
                                <button
                                  type="button"
                                  disabled={ocupado === chave}
                                  onClick={() => {
                                    const bloquear = p.situacao !== 'bloqueado';
                                    if (bloquear && !confirm(`Bloquear ${p.email}? A pessoa não consegue mais usar a ferramenta.`)) return;
                                    agir(chave, { acao: bloquear ? 'bloquear' : 'liberar', contaId: p.contaId }, bloquear ? `${p.email} bloqueado.` : `${p.email} liberado.`);
                                  }}
                                  className={`rounded-full px-2.5 py-1.5 text-[12px] font-bold ${p.situacao === 'bloqueado' ? 'bg-tinta text-white' : 'text-red-700 ring-1 ring-inset ring-red-200 hover:bg-rosa'}`}
                                >
                                  {p.situacao === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-zinc-500">ainda não entrou na ferramenta</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!lista.length && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[13px] text-zinc-500">Ninguém aqui.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------- pagamentos */}
        {aba === 'pagamentos' && (
          <div className="mt-6 overflow-x-auto rounded-[24px] border border-zinc-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-zinc-50 text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <th className="py-3 pl-5 pr-3">Quando</th>
                  <th className="px-3 py-3">Quem</th>
                  <th className="px-3 py-3">Plano</th>
                  <th className="px-3 py-3">Como</th>
                  <th className="px-3 py-3 pr-5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.pagamentos.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-200 last:border-b-0">
                    <td className="py-3 pl-5 pr-3 tabular-nums">{new Date(g.pagoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-3 font-semibold">{g.email || '—'}</td>
                    <td className="px-3 py-3">{PLANO[g.plano] || g.plano}</td>
                    <td className="px-3 py-3">{g.descricao || (g.forma === 'pix' ? 'Pix' : 'Cartão')}</td>
                    <td className="px-3 py-3 pr-5 text-right font-bold tabular-nums">{brl(g.valorCentavos)}</td>
                  </tr>
                ))}
                {!dados.pagamentos.length && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[13px] text-zinc-500">Nenhum pagamento ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'acessos' && (
          <div className="mt-6">
            <PainelAcessos meuIp={meuIp} />
          </div>
        )}
      </div>
    </div>
  );
}
