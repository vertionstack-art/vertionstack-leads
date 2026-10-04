import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { financeiroDaConta } from '@/lib/financeiro';

export const dynamic = 'force-dynamic';

const brl = (v: number, centavos = false) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: centavos ? 2 : 0 });
const num = (n: number) => n.toLocaleString('pt-BR');
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-[24px] bg-zinc-50 p-5">
      <p className="text-[12.5px] font-bold text-zinc-500">{titulo}</p>
      <p className="mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{valor}</p>
      <p className="mt-2 text-[12px] font-medium text-zinc-500">{detalhe}</p>
    </div>
  );
}

export default async function PaginaFinanceiro() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const f = await financeiroDaConta(sessao.contaId);
  const t = f.totais;

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' });
  const maiorMes = Math.max(1, ...f.meses.map((m) => m.receita));
  const etapas = [
    { rotulo: 'Novos', n: f.funil.novo },
    { rotulo: 'Contatados', n: f.funil.contatado },
    { rotulo: 'Negociando', n: f.funil.negociando },
    { rotulo: 'Fechados', n: f.funil.fechado },
  ];
  const maiorEtapa = Math.max(1, ...etapas.map((e) => e.n));
  const progressoMeta = f.meta ? Math.min(1, t.receitaMes / f.meta) : 0;

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1180px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Financeiro</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">Os clientes que você fechou e quanto eles renderam</p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>

        {/* ------------------------------------------- o mês, em destaque */}
        <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col rounded-[24px] bg-ceu p-6">
            <p className="text-[13px] font-bold text-sky-950/70">Fechado em {mesNome}</p>
            <p className="mt-2 text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{brl(t.receitaMes)}</p>
            <p className="mt-2 text-[13px] font-semibold text-sky-950/70">
              {t.clientesMes === 1 ? '1 cliente fechado' : `${num(t.clientesMes)} clientes fechados`} este mês, em entradas
            </p>
            {f.meta > 0 ? (
              <div className="mt-auto pt-6">
                <div className="flex items-baseline justify-between text-[12.5px] font-bold text-sky-950/80">
                  <span>Meta {brl(f.meta)}</span>
                  <span className="tabular-nums">
                    {t.receitaMes >= f.meta ? 'Meta batida' : `faltam ${brl(f.meta - t.receitaMes)}`}
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/70" role="img" aria-label={`${Math.round(progressoMeta * 100)}% da meta`}>
                  <div className="h-full rounded-full bg-tinta" style={{ width: `${progressoMeta * 100}%` }} />
                </div>
              </div>
            ) : (
              <Link href="/perfil" className="mt-auto pt-6 text-[12.5px] font-bold text-sky-950/80 underline underline-offset-2">
                Definir uma meta de vendas do mês
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Indicador titulo="Clientes fechados" valor={num(t.clientes)} detalhe="desde o começo" />
            <Indicador titulo="Mensalidade contratada" valor={brl(t.recorrencia)} detalhe="entra todo mês" />
            <Indicador titulo="Ticket médio" valor={t.ticketMedio ? brl(t.ticketMedio) : '—'} detalhe="entrada por cliente" />
            <Indicador
              titulo="Conversão"
              valor={t.conversao === null ? '—' : `${Math.round(t.conversao * 100)}%`}
              detalhe="dos leads que você abordou"
            />
          </div>
        </section>

        {/* ----------------------------------------- 6 meses + na mesa */}
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-zinc-200 p-6">
            <h2 className="text-[17px] font-extrabold">Entradas fechadas por mês</h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">Últimos 6 meses · passe o mouse para ver os clientes</p>
            <div className="mt-6 flex h-[180px] items-end gap-3 border-b border-zinc-200" role="img" aria-label="Gráfico de entradas por mês">
              {f.meses.map((m) => (
                <div key={m.mes} className="group relative flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-[11px] font-bold tabular-nums text-zinc-600">
                    {m.receita ? brl(m.receita).replace(/\s/g, ' ') : ''}
                  </span>
                  <div
                    className="mx-auto w-full max-w-[56px] rounded-t-[4px] bg-tinta transition-opacity group-hover:opacity-80"
                    style={{ height: `${Math.max(m.receita ? 4 : 0, (m.receita / maiorMes) * 140)}px` }}
                  />
                  <span className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tinta px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-[0_6px_16px_rgba(11,11,15,0.2)] transition-opacity group-hover:opacity-100">
                    {m.clientes === 1 ? '1 cliente' : `${m.clientes} clientes`} · {brl(m.receita)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3">
              {f.meses.map((m) => (
                <span key={m.mes} className="flex-1 text-center text-[12px] font-semibold capitalize text-zinc-500">
                  {m.rotulo}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-[24px] bg-tinta p-6 text-white">
            <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
              Na{' '}
              <span className="inline-block -rotate-2 rounded-full border border-white/70 px-2.5 py-0.5 text-[18px]">mesa</span>
            </h2>
            <p className="mt-3 text-[36px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{brl(t.valorNaMesa)}</p>
            <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-white/70">
              {t.abertas === 1 ? '1 proposta enviada' : `${num(t.abertas)} propostas enviadas`} e ainda sem resposta. É o que entra
              se todas fecharem.
            </p>
            <Link
              href="/"
              className="mt-auto inline-flex min-h-[40px] w-fit items-center rounded-full bg-ceu px-5 pt-0 text-[13px] font-bold text-tinta transition-colors hover:bg-white"
            >
              Ir atrás delas
            </Link>
          </div>
        </section>

        {/* --------------------------------------------- funil + nichos */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-zinc-200 p-6">
            <h2 className="text-[17px] font-extrabold">Funil</h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">Onde estão os seus leads agora</p>
            <ul className="mt-5 space-y-3">
              {etapas.map((e) => (
                <li key={e.rotulo} className="grid grid-cols-[96px_minmax(0,1fr)_56px] items-center gap-3 text-[13px]">
                  <span className="font-semibold">{e.rotulo}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-zinc-100">
                    <span className="block h-full rounded-full bg-roxo-600" style={{ width: `${(e.n / maiorEtapa) * 100}%` }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{num(e.n)}</span>
                </li>
              ))}
            </ul>
            {f.funil.descartado > 0 && (
              <p className="mt-4 text-[12px] text-zinc-500">{num(f.funil.descartado)} descartados ficam fora do funil.</p>
            )}
          </div>

          <div className="rounded-[24px] border border-zinc-200 p-6">
            <h2 className="text-[17px] font-extrabold">Onde você mais vende</h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">Ramos com mais entrada fechada</p>
            {f.porNicho.length ? (
              <ul className="mt-4 divide-y divide-zinc-100">
                {f.porNicho.map((n) => (
                  <li key={n.nicho} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate font-semibold">{n.nicho}</span>
                    <span className="flex shrink-0 items-center gap-4 tabular-nums">
                      <span className="text-zinc-500">{n.clientes === 1 ? '1 cliente' : `${n.clientes} clientes`}</span>
                      <b>{brl(n.receita)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-zinc-500">Aparece quando você fechar o primeiro cliente.</p>
            )}
          </div>
        </section>

        {/* ------------------------------------------- clientes fechados */}
        <section className="mt-6">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">
            Clientes fechados <span className="text-[14px] font-bold tabular-nums text-zinc-500">{num(t.clientes)}</span>
          </h2>
          {t.semValor > 0 && (
            <p className="mt-1 text-[12.5px] text-zinc-500">
              {t.semValor === 1 ? '1 cliente fechado' : `${t.semValor} clientes fechados`} sem proposta com valor: entram na contagem, mas não na
              receita.
            </p>
          )}
          {f.clientes.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[12px] font-semibold text-zinc-500">
                  <tr className="border-b border-zinc-100">
                    <th className="py-3 pr-4 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Fechou em</th>
                    <th className="px-4 py-3 text-right font-semibold">Entrada</th>
                    <th className="py-3 pl-4 text-right font-semibold">Mensalidade</th>
                  </tr>
                </thead>
                <tbody>
                  {f.clientes.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 last:border-b-0">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tinta text-[14px] font-extrabold text-white">
                            {(c.nome.match(/[\p{L}\p{N}]/u)?.[0] || '•').toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-bold">{c.nome}</div>
                            <div className="truncate text-[12px] text-zinc-500">{[c.categoria, c.cidade].filter(Boolean).join(' · ') || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-zinc-600">{data(c.fechadoEm)}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums">{c.semValor ? '—' : brl(c.entrada, true)}</td>
                      <td className="py-3.5 pl-4 text-right tabular-nums text-zinc-600">{c.mensalidade ? `${brl(c.mensalidade, true)}/mês` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] bg-zinc-50 px-6 py-12 text-center">
              <p className="text-[16px] font-extrabold">Nenhum cliente fechado ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-zinc-600">
                Quando um cliente aceitar, abra a PROPOSTA dele no painel e clique em &quot;marcar como fechado&quot;. Ele aparece aqui
                na hora, com a entrada e a mensalidade.
              </p>
              <Link href="/" className="mt-5 inline-flex min-h-[40px] items-center rounded-full bg-tinta px-5 text-[13px] font-bold text-white hover:bg-tinta-70">
                Ir para os leads
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
