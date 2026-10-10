'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import type { IdPasso, Passo } from '@/lib/passos';

/**
 * O guia do topo do painel para quem acabou de chegar. Cada passo se marca
 * sozinho quando a coisa acontece de verdade (lib/passos); "não mostrar
 * mais" esconde para sempre.
 */

const TEXTO: Record<IdPasso, { titulo: string; dica: string; acao?: { rotulo: string; href: string } }> = {
  busca: {
    titulo: 'Faça sua primeira busca',
    dica: 'Escolha o ramo e a cidade. A lista chega com quem não tem site e já com temperatura.',
    acao: { rotulo: 'Buscar', href: '/buscar' },
  },
  empresa: {
    titulo: 'Coloque o nome da sua empresa',
    dica: 'Ele entra na mensagem do WhatsApp e na proposta.',
    acao: { rotulo: 'Meu perfil', href: '/perfil' },
  },
  whatsapp: {
    titulo: 'Chame um lead quente no WhatsApp',
    dica: 'Clique em WhatsApp num lead da lista: a mensagem já vem escrita com o motivo daquele comércio.',
  },
  proposta: {
    titulo: 'Monte sua primeira proposta',
    dica: 'Em PROPOSTA, no lead. O link avisa quando o cliente abrir.',
  },
  lembrete: {
    titulo: 'Marque um lembrete para o retorno',
    dica: 'Na ficha do lead, aba Lembrete. Ele aparece em "Para hoje" no CRM no dia certo.',
  },
};

export default function PrimeirosPassos({ passos }: { passos: Passo[] }) {
  const [visivel, setVisivel] = useState(true);
  if (!visivel) return null;
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito)?.id;

  async function esconder() {
    setVisivel(false);
    await fetch('/api/conta/passos', { method: 'POST' }).catch(() => {});
  }

  return (
    <section aria-labelledby="t-passos" className="mt-6 rounded-[24px] bg-zinc-50 p-5 ring-1 ring-inset ring-zinc-200 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="t-passos" className="text-[17px] font-extrabold tracking-[-0.02em]">Primeiros passos</h2>
          <p className="mt-0.5 text-[13px] font-medium text-zinc-600">
            <span className="tabular-nums">{feitos} de {passos.length}</span> feitos. Faça uma vez e você já sabe usar tudo.
          </p>
        </div>
        <button
          type="button"
          onClick={esconder}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[12.5px] font-bold text-zinc-500 transition-colors hover:bg-white hover:text-tinta"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
          Não mostrar mais
        </button>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-zinc-200">
        <div className="h-full rounded-full bg-tinta transition-[width] duration-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>

      <ol className="mt-4 grid gap-2 md:grid-cols-5">
        {passos.map((p) => {
          const t = TEXTO[p.id];
          const atual = p.id === proximo;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 md:flex-col md:items-start md:gap-2 md:p-3.5 ${atual ? 'bg-white ring-2 ring-tinta' : p.feito ? 'bg-white/60' : 'bg-white/60'}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  p.feito ? 'bg-tinta text-white' : 'bg-white ring-2 ring-inset ring-zinc-300'
                }`}
                aria-hidden
              >
                {p.feito && <Check className="h-4 w-4" strokeWidth={2.6} />}
              </span>
              <div className="min-w-0">
                <p className={`text-[13.5px] font-extrabold leading-snug ${p.feito ? 'text-zinc-500 line-through decoration-zinc-400' : ''}`}>
                  {t.titulo}
                  <span className="sr-only">{p.feito ? ' (feito)' : ''}</span>
                </p>
                {!p.feito && <p className={`mt-1 text-[12.5px] leading-snug text-zinc-600 ${atual ? '' : 'hidden md:block'}`}>{t.dica}</p>}
                {!p.feito && t.acao && (
                  <Link
                    href={t.acao.href}
                    className={`mt-2.5 min-h-[36px] items-center rounded-full px-3.5 text-[12.5px] font-bold transition-colors ${atual ? 'inline-flex' : 'hidden md:inline-flex'} ${
                      atual ? 'bg-tinta text-white hover:bg-tinta-70' : 'ring-1 ring-inset ring-zinc-300 hover:ring-tinta'
                    }`}
                  >
                    {t.acao.rotulo}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
