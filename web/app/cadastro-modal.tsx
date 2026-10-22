'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Store, UserRound, X } from 'lucide-react';
import { INTERESSES } from '@/lib/interesses';

/**
 * Cadastro de um lead à mão: um comércio ou uma pessoa.
 *
 * A extensão cobre o que está no Maps, mas boa parte do que vira cliente
 * chega por indicação, por conversa de balcão ou de um perfil que alguém
 * mandou no WhatsApp. E nem todo cliente é comércio: tem a pessoa que quer
 * um site pessoal, um sistema, uma automação. Aqui fica o que ele quer, a
 * ideia que contou e, se já marcou, a reunião (vira o lembrete do lead).
 *
 * Só o nome é obrigatório: exigir mais faria a pessoa desistir de cadastrar
 * no meio da rua, que é quando isso costuma acontecer.
 */

type Tipo = 'comercio' | 'pessoa';

interface Campos {
  name: string;
  category: string;
  phone: string;
  address: string;
  city: string;
  website: string;
  instagram: string;
  email: string;
  mapsUrl: string;
  notes: string;
  ideia: string;
  reuniaoEm: string;
  reuniaoTexto: string;
}

const VAZIO: Campos = {
  name: '',
  category: '',
  phone: '',
  address: '',
  city: '',
  website: '',
  instagram: '',
  email: '',
  mapsUrl: '',
  notes: '',
  ideia: '',
  reuniaoEm: '',
  reuniaoTexto: '',
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
  const [tipo, setTipo] = useState<Tipo>('comercio');
  const [c, setC] = useState<Campos>(VAZIO);
  const [interesse, setInteresse] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const set = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setC((a) => ({ ...a, [campo]: e.target.value }));

  const pessoa = tipo === 'pessoa';

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!c.name.trim()) {
      setErro(pessoa ? 'O nome da pessoa é o único campo obrigatório.' : 'O nome do comércio é o único campo obrigatório.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const r = await fetch('/api/leads/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          nome: c.name,
          categoria: c.category,
          telefone: c.phone,
          endereco: c.address,
          cidade: c.city,
          site: c.website,
          instagram: normalizarInstagram(c.instagram),
          email: c.email,
          mapsUrl: c.mapsUrl,
          notas: c.notes,
          interesse,
          ideia: c.ideia,
          // o datetime-local vem sem fuso: o navegador lê na hora local de quem cadastrou
          reuniaoEm: c.reuniaoEm ? new Date(c.reuniaoEm).toISOString() : null,
          reuniaoTexto: c.reuniaoTexto,
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

  const campo = 'min-h-[44px] w-full rounded-full border border-zinc-300 px-4 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const caixa = 'w-full rounded-2xl border border-zinc-300 px-3 py-2 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
  const rotulo = 'mb-1 block text-[13px] font-bold text-tinta';
  const secao = 'mb-3 mt-6 text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-zinc-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4" onClick={aoFechar}>
      <form
        onSubmit={salvar}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(11,11,15,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight">Cadastrar lead</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Para quem chegou por indicação ou conversa, fora da varredura do Maps.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full px-2 py-1 text-[18px] leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {erro && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800">
              {erro}
            </div>
          )}

          {/* ------------------------------------------- comércio ou pessoa */}
          <div role="radiogroup" aria-label="Quem é o lead" className="mb-5 grid grid-cols-2 gap-2">
            {([
              { v: 'comercio', rotulo: 'Comércio', detalhe: 'Loja, empresa, profissional', Icone: Store, fundo: 'bg-ceu' },
              { v: 'pessoa', rotulo: 'Pessoa', detalhe: 'Cliente pessoa física', Icone: UserRound, fundo: 'bg-rosa' },
            ] as const).map(({ v, rotulo: r, detalhe, Icone, fundo }) => {
              const marcado = tipo === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  onClick={() => setTipo(v)}
                  className={`flex min-h-[64px] items-center gap-3 rounded-[18px] border-2 px-3.5 text-left transition ${
                    marcado ? 'border-tinta bg-white' : 'border-transparent bg-zinc-100 hover:bg-zinc-200/70'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${fundo} text-tinta`}>
                    <Icone aria-hidden className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-extrabold leading-tight">{r}</span>
                    <span className="block text-[11.5px] font-medium text-zinc-500">{detalhe}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <label className={rotulo} htmlFor="c-nome">
              {pessoa ? 'Nome da pessoa *' : 'Nome do comércio *'}
            </label>
            <input
              id="c-nome"
              value={c.name}
              onChange={set('name')}
              autoFocus
              className={campo}
              placeholder={pessoa ? 'Mariana Souza' : 'Barbearia do Zé'}
            />
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="c-ramo">{pessoa ? 'Profissão ou área' : 'Ramo'}</label>
              <input
                id="c-ramo"
                value={c.category}
                onChange={set('category')}
                className={campo}
                placeholder={pessoa ? 'Psicóloga, coach, criador...' : 'Barbearia'}
              />
            </div>
            <div>
              <label className={rotulo} htmlFor="c-fone">{pessoa ? 'WhatsApp' : 'Telefone'}</label>
              <input id="c-fone" value={c.phone} onChange={set('phone')} className={campo} placeholder="(31) 99999-0000" inputMode="tel" />
            </div>
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {!pessoa && (
              <div>
                <label className={rotulo} htmlFor="c-end">Endereço</label>
                <input id="c-end" value={c.address} onChange={set('address')} className={campo} placeholder="R. Pernambuco, 1052" />
              </div>
            )}
            <div>
              <label className={rotulo} htmlFor="c-cidade">{pessoa ? 'Cidade' : 'Cidade ou bairro'}</label>
              <input id="c-cidade" value={c.city} onChange={set('city')} className={campo} placeholder={pessoa ? 'Belo Horizonte' : 'Savassi BH'} />
            </div>
            {pessoa && (
              <div>
                <label className={rotulo} htmlFor="c-email">E-mail</label>
                <input id="c-email" type="email" value={c.email} onChange={set('email')} className={campo} placeholder="mariana@gmail.com" />
              </div>
            )}
          </div>

          {/* ------------------------------------------- o que ele quer */}
          <p className={secao}>O que ele quer</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="O que ele quer">
            {INTERESSES.map((it) => {
              const marcado = interesse.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    setInteresse((a) => (a.includes(it.id) ? a.filter((x) => x !== it.id) : [...a, it.id]))
                  }
                  className={`min-h-[40px] rounded-full px-3.5 text-[12.5px] font-bold transition ${
                    marcado ? 'bg-tinta text-white' : 'bg-lavanda text-tinta hover:bg-roxo-100'
                  }`}
                >
                  {it.rotulo}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className={rotulo} htmlFor="c-ideia">Descreva a ideia</label>
            <textarea
              id="c-ideia"
              value={c.ideia}
              onChange={set('ideia')}
              rows={4}
              className={caixa}
              placeholder="O que ele contou: para que serve, o que precisa ter, referências que mostrou, prazo, quanto pensa em investir..."
            />
          </div>

          {/* ------------------------------------------- reunião */}
          <p className={secao}>Reunião</p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <label className={rotulo} htmlFor="c-reuniao">
                <CalendarClock aria-hidden className="mr-1 inline h-4 w-4 -translate-y-px" strokeWidth={2} />
                Dia e hora
              </label>
              <input id="c-reuniao" type="datetime-local" value={c.reuniaoEm} onChange={set('reuniaoEm')} className={campo} />
            </div>
            <div>
              <label className={rotulo} htmlFor="c-reuniao-txt">Onde ou como</label>
              <input
                id="c-reuniao-txt"
                value={c.reuniaoTexto}
                onChange={set('reuniaoTexto')}
                className={campo}
                placeholder="Google Meet, no escritório dele..."
                maxLength={150}
              />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Se marcar, a reunião vira o lembrete do lead e aparece em &quot;Para hoje&quot; no CRM.
          </p>

          {/* ------------------------------------------- mais dados */}
          <p className={secao}>Mais dados</p>
          {!pessoa && (
            <div className="mb-4">
              <label className={rotulo} htmlFor="c-maps">Link do Google Maps</label>
              <input id="c-maps" value={c.mapsUrl} onChange={set('mapsUrl')} className={campo} placeholder="https://maps.app.goo.gl/..." />
              <p className="mt-1 text-[11px] text-zinc-500">
                No Maps, abra o comércio e toque em <em>Compartilhar</em> para copiar este link.
              </p>
            </div>
          )}

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="c-insta">Instagram</label>
              <input id="c-insta" value={c.instagram} onChange={set('instagram')} className={campo} placeholder={pessoa ? '@mariana' : '@barbeariadoze'} />
            </div>
            {!pessoa && (
              <div>
                <label className={rotulo} htmlFor="c-email">E-mail</label>
                <input id="c-email" type="email" value={c.email} onChange={set('email')} className={campo} placeholder="contato@barbeariadoze.com.br" />
              </div>
            )}
            <div>
              <label className={rotulo} htmlFor="c-site">Site, se tiver</label>
              <input id="c-site" value={c.website} onChange={set('website')} className={campo} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className={rotulo} htmlFor="c-nota">Anotação</label>
            <textarea
              id="c-nota"
              value={c.notes}
              onChange={set('notes')}
              rows={2}
              className={caixa}
              placeholder="Indicação do João da pizzaria"
            />
          </div>
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
            disabled={salvando || !c.name.trim()}
            className="min-h-[44px] rounded-full bg-tinta px-5 text-[13px] font-semibold text-white transition hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            {salvando ? 'Salvando…' : 'Cadastrar lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
