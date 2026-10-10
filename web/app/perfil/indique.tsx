'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Gift, MessageCircle } from 'lucide-react';
import type { ResumoIndicacao } from '@/lib/indicacao';

/**
 * Indique e ganhe, em Meu perfil: o link de convite, o saldo de bônus e quem
 * já entrou pelo link. O bônus só entra quando o convidado assina um plano.
 */

const SITUACAO: Record<ResumoIndicacao['indicacoes'][number]['situacao'], { rotulo: string; classe: string }> = {
  aguardando: { rotulo: 'Ainda não assinou', classe: 'bg-white text-zinc-600 ring-zinc-300' },
  creditada: { rotulo: 'Assinou · bônus creditado', classe: 'bg-menta text-emerald-950 ring-emerald-200' },
  recusada: { rotulo: 'Não vale (mesmo aparelho ou e-mail)', classe: 'bg-zinc-100 text-zinc-500 ring-zinc-200' },
};

export default function Indique({ resumo, bonusLeads, bonusBuscas }: { resumo: ResumoIndicacao; bonusLeads: number; bonusBuscas: number }) {
  const [link, setLink] = useState(`/?convite=${resumo.codigo}`);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/?convite=${resumo.codigo}`);
  }, [resumo.codigo]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o link continua selecionável */
    }
  }

  const textoZap = `Uso o Vertion Leads para achar comércios sem site e vender site para eles. Testa grátis com 30 leads: ${link}`;

  return (
    <section aria-labelledby="t-indique" className="mt-6 rounded-[24px] border border-zinc-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[560px]">
          <h2 id="t-indique" className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-0.02em]">
            <Gift aria-hidden className="h-5 w-5" />
            Indique e ganhe
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">
            Mande o seu link para outro freelancer. Quando ele <b className="text-tinta">assinar qualquer plano</b>, você ganha{' '}
            <b className="text-tinta">{bonusLeads} leads e {bonusBuscas} buscas</b> a mais. Quem só faz o teste grátis não conta.
          </p>
        </div>
        {(resumo.leadsBonus > 0 || resumo.buscasBonus > 0) && (
          <div className="rounded-2xl bg-menta px-4 py-3 text-emerald-950">
            <p className="text-[12px] font-bold">Seu bônus agora</p>
            <p className="text-[20px] font-extrabold tabular-nums leading-tight">
              {resumo.leadsBonus} leads · {resumo.buscasBonus} buscas
            </p>
            <p className="text-[11.5px] font-semibold opacity-80">Usados quando a cota do plano acabar. Não vencem.</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Seu link de convite"
          className="min-h-[44px] flex-1 rounded-full bg-zinc-100 px-5 text-[13.5px] font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-roxo-200"
        />
        <button
          type="button"
          onClick={copiar}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70"
        >
          {copiado ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(textoZap)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[13.5px] font-bold ring-1 ring-inset ring-zinc-300 transition-colors hover:ring-tinta"
        >
          <MessageCircle aria-hidden className="h-4 w-4" />
          Mandar no WhatsApp
        </a>
      </div>

      {resumo.indicacoes.length > 0 ? (
        <ul className="mt-5 divide-y divide-zinc-200 border-t border-zinc-200">
          {resumo.indicacoes.map((i, n) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-[13.5px] font-bold capitalize">{i.nome}</span>
              <span className="flex items-center gap-3">
                <span className="text-[12px] text-zinc-500">{new Date(i.criadaEm).toLocaleDateString('pt-BR')}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ring-1 ring-inset ${SITUACAO[i.situacao].classe}`}>
                  {SITUACAO[i.situacao].rotulo}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[12.5px] text-zinc-500">Ninguém entrou pelo seu link ainda.</p>
      )}
    </section>
  );
}
