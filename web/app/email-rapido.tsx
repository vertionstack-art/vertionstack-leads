'use client';

import { useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import type { Lead } from '@/lib/db';

/**
 * O e-mail do lead do exterior, direto na tabela do painel: mostra quando
 * tem; quando não tem, um botão abre o campo para colar o que você achou
 * no Instagram, no Facebook ou no site, com o atalho para procurar.
 */
export default function EmailRapido({ lead, aoSalvar }: { lead: Lead; aoSalvar: (email: string) => void }) {
  const [abrindo, setAbrindo] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // onde procurar: Instagram e Facebook primeiro (é onde o dono costuma pôr o e-mail), depois o site
  const ondeProcurar =
    lead.redes?.instagram || lead.instagram || lead.redes?.facebook || (lead.websiteKind === 'site' ? lead.website : null) || lead.website || null;
  const nomeDoLugar = !ondeProcurar ? null : /instagram\.com/i.test(ondeProcurar) ? 'Instagram' : /facebook\.com|fb\.com/i.test(ondeProcurar) ? 'Facebook' : 'site';

  async function salvar() {
    const v = valor.trim();
    if (!v) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.erro || 'Não consegui salvar.');
      aoSalvar(v.toLowerCase());
      setAbrindo(false);
      setValor('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (lead.email) {
    return (
      <a
        href={`mailto:${lead.email}`}
        title={lead.email}
        className="inline-flex max-w-[230px] items-center gap-1.5 rounded-full bg-menta px-2.5 py-1 text-[11.5px] font-bold text-emerald-950 hover:brightness-95"
      >
        <Mail aria-hidden className="h-3 w-3 shrink-0" />
        <span className="truncate">{lead.email}</span>
      </a>
    );
  }

  if (!abrindo) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAbrindo(true)}
          className="inline-flex items-center gap-1 rounded-full bg-manteiga px-2.5 py-1 text-[11.5px] font-bold text-amber-950 hover:brightness-95"
        >
          <Plus aria-hidden className="h-3 w-3" /> Sem e-mail · adicionar
        </button>
        {ondeProcurar && (
          <a href={ondeProcurar} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-semibold text-zinc-500 underline underline-offset-2 hover:text-tinta">
            procurar no {nomeDoLugar}
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className="w-[230px]"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="flex gap-1">
        <input
          type="email"
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setAbrindo(false)}
          placeholder="cole o e-mail"
          aria-label={`E-mail de ${lead.name}`}
          className="min-w-0 flex-1 rounded-full bg-zinc-100 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-tinta"
        />
        <button type="submit" disabled={salvando || !valor.trim()} className="shrink-0 rounded-full bg-tinta px-3 text-[11.5px] font-bold text-white disabled:opacity-40">
          {salvando ? '…' : 'Salvar'}
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {ondeProcurar && (
          <a href={ondeProcurar} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-500 underline underline-offset-2 hover:text-tinta">
            procurar no {nomeDoLugar}
          </a>
        )}
        <button type="button" onClick={() => setAbrindo(false)} className="font-semibold text-zinc-400 hover:text-tinta">
          cancelar
        </button>
      </div>
      {erro && <p role="alert" className="mt-1 text-[11.5px] font-semibold text-red-700">{erro}</p>}
    </form>
  );
}
