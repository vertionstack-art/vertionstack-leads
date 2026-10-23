'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Store, UserRound, X } from 'lucide-react';
import { INTERESSES } from '@/lib/interesses';

/**
 * Corrigir os dados de um lead: o WhatsApp que não funcionou, o nome, o site,
 * o que ele quer. Abre da ficha do lead e da tela da conversa. O servidor
 * recalcula o que depende disso (WhatsApp, tipo de site) e anota no
 * histórico o que mudou.
 */

interface Dados {
  name: string;
  category: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  address: string;
  website: string;
  instagram: string;
  mapsUrl: string;
  tipo: 'comercio' | 'pessoa';
  interesse: string[];
  ideia: string;
}

/** aceita "@fulano", "fulano" ou a URL inteira e guarda sempre como link */
function normalizarInstagram(v: string): string {
  const t = v.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://instagram.com/' + t.replace(/^@/, '').replace(/^instagram\.com\//i, '');
}

/** "5521967743570" → "(21) 96774-3570", para a pessoa reconhecer o número */
function mostrarNumero(n: string): string {
  const d = n.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n;
}

export default function EditarLeadModal({
  leadId,
  aoFechar,
  aoSalvar,
}: {
  leadId: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [d, setD] = useState<Dados | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = `/api/leads/${encodeURIComponent(leadId)}/dados`;

  useEffect(() => {
    let vivo = true;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (!j.ok) throw new Error(j.erro);
        setD({ ...j.dados, whatsapp: j.dados.whatsapp ? mostrarNumero(j.dados.whatsapp) : '' });
      })
      .catch((e) => vivo && setErro((e as Error).message || 'Não consegui abrir os dados do lead.'));
    return () => {
      vivo = false;
    };
  }, [url]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const set = (k: keyof Dados) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((a) => (a ? { ...a, [k]: e.target.value } : a));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    if (!d.name.trim()) {
      setErro('O nome não pode ficar vazio.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, instagram: normalizarInstagram(d.instagram) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'Não consegui salvar.');
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  }

  const campo = 'min-h-[44px] w-full rounded-full border border-zinc-300 px-4 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const caixa = 'w-full rounded-2xl border border-zinc-300 px-3 py-2 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const rotulo = 'mb-1 block text-[13px] font-bold text-tinta';
  const pessoa = d?.tipo === 'pessoa';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-tinta/40 p-4" onClick={aoFechar}>
      <form
        onSubmit={salvar}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">Editar lead</h2>
            <p className="mt-0.5 truncate text-[12px] text-zinc-500">{d?.name || 'Carregando…'}</p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full px-2 py-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {erro && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">{erro}</div>
          )}
          {!d && !erro && <p className="py-10 text-center text-[13px] text-zinc-500">Carregando os dados…</p>}

          {d && (
            <>
              <div role="radiogroup" aria-label="Quem é o lead" className="mb-5 grid grid-cols-2 gap-2">
                {([
                  { v: 'comercio', r: 'Comércio', Icone: Store, fundo: 'bg-ceu' },
                  { v: 'pessoa', r: 'Pessoa', Icone: UserRound, fundo: 'bg-rosa' },
                ] as const).map(({ v, r, Icone, fundo }) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={d.tipo === v}
                    onClick={() => setD((a) => (a ? { ...a, tipo: v } : a))}
                    className={`flex min-h-[52px] items-center gap-3 rounded-[16px] border-2 px-3.5 text-left transition ${
                      d.tipo === v ? 'border-tinta bg-white' : 'border-transparent bg-zinc-100 hover:bg-zinc-200/70'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${fundo} text-tinta`}>
                      <Icone aria-hidden className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="text-[13.5px] font-extrabold">{r}</span>
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className={rotulo} htmlFor="e-nome">{pessoa ? 'Nome da pessoa *' : 'Nome do comércio *'}</label>
                <input id="e-nome" value={d.name} onChange={set('name')} maxLength={250} className={campo} />
              </div>

              <div className="mb-4 rounded-[18px] bg-menta/60 p-4">
                <label className={rotulo} htmlFor="e-zap">
                  <MessageCircle aria-hidden className="mr-1 inline h-4 w-4 -translate-y-px" strokeWidth={2} />
                  WhatsApp
                </label>
                <input id="e-zap" value={d.whatsapp} onChange={set('whatsapp')} inputMode="tel" className={`${campo} bg-white`} placeholder="(21) 99999-0000" />
                <p className="mt-1.5 text-[11.5px] leading-snug text-zinc-700">
                  É o número usado para mandar mensagem e reconhecer as respostas. Deixe vazio para usar o telefone abaixo, se for celular.
                </p>
              </div>

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={rotulo} htmlFor="e-fone">Telefone</label>
                  <input id="e-fone" value={d.phone} onChange={set('phone')} inputMode="tel" className={campo} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="e-ramo">{pessoa ? 'Profissão ou área' : 'Ramo'}</label>
                  <input id="e-ramo" value={d.category} onChange={set('category')} className={campo} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="e-email">E-mail</label>
                  <input id="e-email" type="email" value={d.email} onChange={set('email')} className={campo} />
                </div>
                <div>
                  <label className={rotulo} htmlFor="e-cidade">Cidade</label>
                  <input id="e-cidade" value={d.city} onChange={set('city')} className={campo} />
                </div>
                {!pessoa && (
                  <div className="sm:col-span-2">
                    <label className={rotulo} htmlFor="e-end">Endereço</label>
                    <input id="e-end" value={d.address} onChange={set('address')} className={campo} />
                  </div>
                )}
                <div>
                  <label className={rotulo} htmlFor="e-site">Site</label>
                  <input id="e-site" value={d.website} onChange={set('website')} className={campo} placeholder="Vazio se não tiver" />
                </div>
                <div>
                  <label className={rotulo} htmlFor="e-insta">Instagram</label>
                  <input id="e-insta" value={d.instagram} onChange={set('instagram')} className={campo} placeholder="@perfil" />
                </div>
                {!pessoa && (
                  <div className="sm:col-span-2">
                    <label className={rotulo} htmlFor="e-maps">Link do Google Maps</label>
                    <input id="e-maps" value={d.mapsUrl} onChange={set('mapsUrl')} className={campo} />
                  </div>
                )}
              </div>

              <p className={`${rotulo} mt-2`}>O que ele quer</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="O que ele quer">
                {INTERESSES.map((it) => {
                  const marcado = d.interesse.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() =>
                        setD((a) => (a ? { ...a, interesse: marcado ? a.interesse.filter((x) => x !== it.id) : [...a.interesse, it.id] } : a))
                      }
                      className={`min-h-[38px] rounded-full px-3.5 text-[12.5px] font-bold transition ${
                        marcado ? 'bg-tinta text-white' : 'bg-lavanda text-tinta hover:bg-roxo-100'
                      }`}
                    >
                      {it.rotulo}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className={rotulo} htmlFor="e-ideia">A ideia que ele contou</label>
                <textarea id="e-ideia" value={d.ideia} onChange={set('ideia')} rows={3} maxLength={3000} className={caixa} />
              </div>
              <p className="mt-3 text-[11.5px] text-zinc-500">
                Trocar o site refaz a classificação (sem site, rede social, site próprio). O que mudar fica anotado no histórico do lead.
              </p>
            </>
          )}
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
            disabled={salvando || !d || !d.name.trim()}
            className="min-h-[44px] rounded-full bg-tinta px-5 text-[13px] font-semibold text-white transition hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
