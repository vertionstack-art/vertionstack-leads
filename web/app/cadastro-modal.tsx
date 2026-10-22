'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, ClipboardPaste, Copy, FileDown, FileUp, Store, UserRound, X } from 'lucide-react';
import { INTERESSES } from '@/lib/interesses';
import { lerCamposDoPdf, lerTexto, temAlgo, type Preenchido } from '@/lib/formulario-cadastro';

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
 *
 * Opcional: o próprio cliente preenche. A ficha sai como texto para o
 * WhatsApp ou como PDF com campos de digitar (lib/formulario-cadastro); a
 * resposta colada, ou o PDF devolvido, preenche os campos daqui.
 */

/** os campos de um PDF preenchido, lidos no navegador (a biblioteca só carrega quando usada) */
async function lerPdf(arquivo: File): Promise<Preenchido> {
  const { PDFDocument, PDFCheckBox, PDFTextField } = await import('pdf-lib');
  const doc = await PDFDocument.load(await arquivo.arrayBuffer(), { ignoreEncryption: true });
  const valores: Record<string, string | boolean> = {};
  for (const campo of doc.getForm().getFields()) {
    if (campo instanceof PDFTextField) valores[campo.getName()] = campo.getText() || '';
    else if (campo instanceof PDFCheckBox) valores[campo.getName()] = campo.isChecked();
  }
  return lerCamposDoPdf(valores);
}

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
  const [copiada, setCopiada] = useState(false);
  const [trazendo, setTrazendo] = useState(false);
  const [resposta, setResposta] = useState('');
  const [lida, setLida] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const set = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setC((a) => ({ ...a, [campo]: e.target.value }));

  const pessoa = tipo === 'pessoa';

  async function copiarFicha() {
    setErro(null);
    try {
      const r = await fetch('/api/leads/formulario?formato=texto');
      const d = await r.json();
      if (!d.ok) throw new Error();
      await navigator.clipboard.writeText(d.texto);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2200);
    } catch {
      setErro('Não consegui copiar a ficha. Tente de novo.');
    }
  }

  /** o que o cliente mandou vira os campos do cadastro; nada é salvo antes de conferir */
  function preencherCom(p: Preenchido, origem: 'texto' | 'pdf') {
    if (!temAlgo(p)) {
      setErro(origem === 'pdf'
        ? 'Esse PDF não tem a ficha preenchida. Confira se é o arquivo que o cliente devolveu.'
        : 'Não achei nada preenchido nessa mensagem. Cole a resposta inteira do cliente.');
      return;
    }
    const comercio = p.tipo !== 'pessoa' && Boolean(p.empresa);
    const notas = [
      comercio && p.nome ? `Contato: ${p.nome}` : '',
      p.reuniao ? `Melhor horário para conversar: ${p.reuniao}` : '',
    ].filter(Boolean);
    setTipo(comercio ? 'comercio' : p.tipo || 'pessoa');
    setC((a) => ({
      ...a,
      name: (comercio ? p.empresa : p.nome || p.empresa) || a.name,
      category: p.ramo || a.category,
      phone: p.telefone || a.phone,
      email: p.email || a.email,
      city: p.cidade || a.city,
      address: p.endereco || a.address,
      instagram: p.instagram || a.instagram,
      website: p.site || a.website,
      ideia: [p.ideia, p.outro && `Outro: ${p.outro}`].filter(Boolean).join('\n') || a.ideia,
      notes: [a.notes, ...notas].filter(Boolean).join('\n'),
    }));
    setInteresse((a) => [...new Set([...a, ...p.interesse])]);
    setErro(null);
    setTrazendo(false);
    setResposta('');
    setLida('Ficha do cliente lida. Confira os campos abaixo e clique em Cadastrar lead.');
  }

  async function aoEscolherPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      setErro('Esse arquivo é grande demais para ser a ficha (mais de 10 MB).');
      return;
    }
    try {
      preencherCom(await lerPdf(arquivo), 'pdf');
    } catch {
      setErro('Não consegui abrir esse PDF. Peça para o cliente salvar de novo depois de preencher.');
    }
  }

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

          {/* ------------------------------------------- o cliente preenche (opcional) */}
          <div className="mb-5 rounded-[18px] bg-chao p-4">
            <p className="text-[13px] font-extrabold">Prefere que o cliente preencha?</p>
            <p className="mt-0.5 text-[12px] font-medium text-zinc-700">
              Mande a ficha, ele devolve preenchida e você traz para cá. Os campos se completam sozinhos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copiarFicha}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-bold text-tinta transition hover:bg-roxo-100"
              >
                {copiada ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
                {copiada ? 'Copiada: cole no WhatsApp' : 'Copiar ficha para o WhatsApp'}
              </button>
              <a
                href="/api/leads/formulario"
                download="ficha-de-cadastro.pdf"
                className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-bold text-tinta transition hover:bg-roxo-100"
              >
                <FileDown aria-hidden className="h-4 w-4" />
                Baixar ficha em PDF
              </a>
              <button
                type="button"
                aria-expanded={trazendo}
                onClick={() => setTrazendo((v) => !v)}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition ${
                  trazendo ? 'bg-tinta text-white' : 'bg-white text-tinta hover:bg-roxo-100'
                }`}
              >
                <ClipboardPaste aria-hidden className="h-4 w-4" />
                Trazer ficha preenchida
              </button>
            </div>

            {trazendo && (
              <div className="mt-3 rounded-[14px] bg-white p-3">
                <label className={rotulo} htmlFor="c-resposta">Cole a resposta do cliente</label>
                <textarea
                  id="c-resposta"
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={5}
                  className={caixa}
                  placeholder="Cole aqui a mensagem que ele devolveu no WhatsApp"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!resposta.trim()}
                    onClick={() => preencherCom(lerTexto(resposta), 'texto')}
                    className="min-h-[40px] rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white transition hover:bg-tinta-70 disabled:bg-zinc-300"
                  >
                    Preencher com a resposta
                  </button>
                  <span className="text-[12px] font-semibold text-zinc-600">ou</span>
                  <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-[12.5px] font-bold text-tinta transition hover:bg-zinc-200 focus-within:ring-2 focus-within:ring-roxo-200">
                    <FileUp aria-hidden className="h-4 w-4" />
                    Enviar o PDF preenchido
                    <input type="file" accept="application/pdf,.pdf" onChange={aoEscolherPdf} className="sr-only" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {lida && (
            <div role="status" className="mb-4 rounded-2xl bg-menta px-3.5 py-2.5 text-[12.5px] font-semibold text-emerald-950">
              {lida}
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
