'use client';

import { useEffect, useState } from 'react';

/**
 * Cadastro de um comércio à mão.
 *
 * A extensão cobre o que está no Maps, mas boa parte do que vira cliente
 * chega por indicação, por conversa de balcão ou de um perfil que alguém
 * mandou no WhatsApp. Sem isto, esses leads ficariam num bloco de notas
 * fora da ferramenta — e é justamente quem já tem alguma ponte com você.
 *
 * Só o nome é obrigatório: exigir mais faria a pessoa desistir de cadastrar
 * no meio da rua, que é quando isso costuma acontecer.
 */

interface Campos {
  name: string;
  category: string;
  phone: string;
  address: string;
  city: string;
  website: string;
  instagram: string;
  mapsUrl: string;
  notes: string;
}

const VAZIO: Campos = {
  name: '',
  category: '',
  phone: '',
  address: '',
  city: '',
  website: '',
  instagram: '',
  mapsUrl: '',
  notes: '',
};

/** aceita "@fulano", "fulano" ou a URL inteira e guarda sempre como link */
function normalizarInstagram(v: string): string {
  const t = v.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://instagram.com/' + t.replace(/^@/, '');
}

export default function CadastroModal({
  aoFechar,
  aoSalvar,
}: {
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [c, setC] = useState<Campos>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const set = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setC((a) => ({ ...a, [campo]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!c.name.trim()) {
      setErro('O nome do comércio é o único campo obrigatório.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const r = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: [
            {
              // sem place id do Maps, a chave vem do nome com o endereço
              placeKey: `manual:${c.name.trim().toLowerCase()}|${c.city.trim().toLowerCase()}`,
              name: c.name.trim(),
              category: c.category.trim() || null,
              phone: c.phone.trim() || null,
              address: c.address.trim() || null,
              city: c.city.trim() || null,
              website: c.website.trim() || null,
              instagram: normalizarInstagram(c.instagram) || null,
              mapsUrl: c.mapsUrl.trim() || null,
              searchTerm: 'cadastro manual',
            },
          ],
        }),
      });

      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'Não consegui salvar.');

      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(String((err as Error).message));
      setSalvando(false);
    }
  }

  const campo = 'min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={aoFechar}>
      <form
        onSubmit={salvar}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">Cadastrar comércio</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Para quem chegou por indicação ou conversa, fora da varredura do Maps.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {erro && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
              {erro}
            </div>
          )}

          <div className="mb-4">
            <label className={rotulo} htmlFor="c-nome">
              Nome do comércio *
            </label>
            <input id="c-nome" value={c.name} onChange={set('name')} autoFocus className={campo} placeholder="Barbearia do Zé" />
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="c-ramo">Ramo</label>
              <input id="c-ramo" value={c.category} onChange={set('category')} className={campo} placeholder="Barbearia" />
            </div>
            <div>
              <label className={rotulo} htmlFor="c-fone">Telefone</label>
              <input id="c-fone" value={c.phone} onChange={set('phone')} className={campo} placeholder="(31) 99999-0000" inputMode="tel" />
            </div>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="c-end">Endereço</label>
              <input id="c-end" value={c.address} onChange={set('address')} className={campo} placeholder="R. Pernambuco, 1052" />
            </div>
            <div>
              <label className={rotulo} htmlFor="c-cidade">Cidade ou bairro</label>
              <input id="c-cidade" value={c.city} onChange={set('city')} className={campo} placeholder="Savassi BH" />
            </div>
          </div>

          <div className="mb-4">
            <label className={rotulo} htmlFor="c-maps">Link do Google Maps</label>
            <input id="c-maps" value={c.mapsUrl} onChange={set('mapsUrl')} className={campo} placeholder="https://maps.app.goo.gl/..." />
            <p className="mt-1 text-[11px] text-zinc-500">
              No Maps, abra o comércio e toque em <em>Compartilhar</em> para copiar este link.
            </p>
          </div>

          <div className="mb-4">
            <label className={rotulo} htmlFor="c-insta">Instagram</label>
            <input id="c-insta" value={c.instagram} onChange={set('instagram')} className={campo} placeholder="@barbeariadoze" />
            <p className="mt-1 text-[11px] text-zinc-500">
              Pode colar só o @ — a ferramenta monta o endereço.
            </p>
          </div>

          <div className="mb-4">
            <label className={rotulo} htmlFor="c-site">Site, se tiver</label>
            <input id="c-site" value={c.website} onChange={set('website')} className={campo} placeholder="https://..." />
            <p className="mt-1 text-[11px] text-zinc-500">
              Deixe vazio se não tiver — é isso que o marca como oportunidade.
            </p>
          </div>

          <div>
            <label className={rotulo} htmlFor="c-nota">Anotação</label>
            <textarea
              id="c-nota"
              value={c.notes}
              onChange={set('notes')}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
              placeholder="Indicação do João da pizzaria"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-[44px] rounded-lg border border-zinc-300 px-4 text-[13px] font-medium text-zinc-700 transition hover:border-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !c.name.trim()}
            className="min-h-[44px] rounded-lg bg-roxo-600 px-5 text-[13px] font-semibold text-white transition hover:bg-roxo-700 disabled:bg-zinc-300"
          >
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
