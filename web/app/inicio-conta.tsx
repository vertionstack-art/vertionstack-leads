'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PLANOS_A_VENDA } from '@/lib/planos';

/**
 * A conta do "um site paga a ferramenta", com os números da própria pessoa:
 * quanto cobra, quantos comércios chama e quantos precisa chamar para fechar
 * um. Nada aqui é estatística nossa — é simulação, e a página diz isso
 * (os Termos dizem que a ferramenta não garante venda; CDC art. 37).
 *
 * A conta usa os leads que a pessoa CHAMA, não o teto do plano: o teto é
 * "até", e prometer faturamento em cima dele seria prometer leads que a
 * busca pode não trazer.
 */

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CHAMADOS = [50, 100, 200, 300];
const TAXAS = [50, 100, 200];
const PAGOS = PLANOS_A_VENDA.filter((p) => p.precoCentavos > 0);

function lerPreco(texto: string): number {
  const limpo = texto.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000) : 0;
}

export default function ContaDoSite({ precoInicial }: { precoInicial: number }) {
  const [precoTexto, setPrecoTexto] = useState(precoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  const [chamados, setChamados] = useState(100);
  const [taxa, setTaxa] = useState(100);
  const [planoId, setPlanoId] = useState<string>('basic');

  const plano = PAGOS.find((p) => p.plano === planoId) ?? PAGOS[0];
  const custo = plano.precoCentavos / 100;
  const periodo = plano.plano === 'semanal' ? 'semana' : 'mês';
  const preco = lerPreco(precoTexto);
  const sites = Math.floor(chamados / taxa);
  const fatura = sites * preco;
  const sobra = fatura - custo;
  const vezes = custo > 0 ? fatura / custo : 0;
  const periodosPagos = custo > 0 ? Math.floor(preco / custo) : 0;

  const pilula = (sel: boolean) =>
    `min-h-[44px] cursor-pointer rounded-full px-4 text-[13.5px] font-bold tabular-nums transition-colors ${
      sel ? 'bg-tinta text-white' : 'bg-white ring-1 ring-inset ring-zinc-300 hover:ring-tinta'
    }`;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* os números da pessoa */}
      <div className="rounded-[24px] bg-zinc-50 p-6 ring-1 ring-inset ring-zinc-200 md:p-8">
        <label htmlFor="preco-site" className="block text-[14px] font-extrabold">
          Quanto você cobra por um site?
        </label>
        <div className="mt-3 flex min-h-[52px] items-center rounded-full bg-white px-5 ring-1 ring-inset ring-zinc-300 focus-within:ring-2 focus-within:ring-roxo-500">
          <span className="text-[16px] font-bold text-zinc-500">R$</span>
          <input
            id="preco-site"
            inputMode="decimal"
            autoComplete="off"
            value={precoTexto}
            onChange={(e) => setPrecoTexto(e.target.value.slice(0, 12))}
            className="w-full bg-transparent px-2 text-[20px] font-extrabold tabular-nums outline-none"
          />
        </div>
        <p className="mt-2 text-[12.5px] text-zinc-600">Já vem com o preço mínimo que a proposta da ferramenta sugere. Troque pelo seu.</p>

        <fieldset className="mt-7">
          <legend className="text-[14px] font-extrabold">Quantos comércios você chama?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHAMADOS.map((n) => (
              <button key={n} type="button" aria-pressed={chamados === n} onClick={() => setChamados(n)} className={pilula(chamados === n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-[14px] font-extrabold">Fecha 1 site a cada quantos?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {TAXAS.map((n) => (
              <button key={n} type="button" aria-pressed={taxa === n} onClick={() => setTaxa(n)} className={pilula(taxa === n)}>
                1 a cada {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-[14px] font-extrabold">Comparar com o plano</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {PAGOS.map((p) => (
              <button key={p.plano} type="button" aria-pressed={planoId === p.plano} onClick={() => setPlanoId(p.plano)} className={pilula(planoId === p.plano)}>
                {p.nome}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* o resultado: o verde é o dinheiro */}
      <div className="flex flex-col rounded-[24px] bg-menta p-6 text-emerald-950 md:p-8" aria-live="polite">
        {preco <= 0 ? (
          <p className="text-[18px] font-extrabold">Digite quanto você cobra por um site para ver a conta.</p>
        ) : sites > 0 ? (
          <>
            <p className="text-[15px] font-bold">
              Chamando {chamados} comércios e fechando 1 a cada {taxa}, você fecha{' '}
              <span className="tabular-nums">{sites}</span> {sites === 1 ? 'site' : 'sites'} e fatura{' '}
              <span className="tabular-nums">{brl(fatura)}</span>.
            </p>
            <p className="mt-6 text-[14px] font-bold">Tirando a ferramenta, sobra</p>
            <p className="text-[48px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[64px] lg:text-[72px]">{brl(sobra)}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13.5px] font-semibold">
                O {plano.nome} custa <b className="tabular-nums">{brl(custo)}</b> por {periodo}.
              </p>
              <p className="rounded-2xl bg-white/70 px-4 py-3 text-[13.5px] font-semibold">
                Cada R$ 1 que você coloca volta como <b className="tabular-nums">{brl(vezes)}</b>.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold">
              Chamando {chamados} e fechando 1 a cada {taxa}, ainda falta chamar mais gente para fechar o primeiro. Mas quando ele fechar:
            </p>
            <p className="mt-6 text-[48px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[64px]">{brl(preco)}</p>
          </>
        )}
        {preco > 0 && (
          <p className="mt-6 text-[17px] font-extrabold tracking-[-0.01em]">
            {periodosPagos >= 1
              ? `Um único site paga ${periodosPagos} ${plano.plano === 'semanal' ? (periodosPagos === 1 ? 'semana' : 'semanas') : periodosPagos === 1 ? 'mês' : 'meses'} de ${plano.nome}.`
              : `Com esse preço, um site ainda não cobre o ${plano.nome}.`}
          </p>
        )}
        <div className="mt-auto pt-7">
          <Link
            href="/cadastro"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-tinta px-6 text-[14px] font-bold text-white transition-colors hover:bg-tinta-70"
          >
            Achar o meu primeiro cliente grátis
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[12px] font-medium text-emerald-950/75">
            Simulação com os números que você escolheu. Quanto você fecha depende da sua abordagem e do seu preço; a ferramenta
            não garante vendas.
          </p>
        </div>
      </div>
    </div>
  );
}
