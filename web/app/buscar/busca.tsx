'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Play, Plus, Square } from 'lucide-react';

const NICHOS_PADRAO = [
  'Barbearia', 'Clínica', 'Restaurante', 'Academia', 'Imobiliária', 'Oficina mecânica', 'Serralheria', 'Pizzaria',
  'Hamburgueria', 'Cafeteria', 'Padaria', 'Salão de beleza', 'Ótica', 'Pet shop', 'Clínica odontológica', 'Agência de viagens',
];

interface CotaJson {
  ilimitado: boolean;
  usados: number;
  limite: number;
  restantes: number | null;
  teste?: boolean;
  testeNegado?: string | null;
}

interface Linha {
  chave: string;
  pergunta: string;
  pagina: number;
  comercios: number;
  comSite: number;
  jaTinha: number;
  novos: number;
  descartados: number;
  confirmados: number;
  /** 'pulada': já buscada até o fim, sem chamar o Google; 'continuou': retomou de onde parou */
  nota?: 'pulada' | 'continuou';
}

interface Descartes {
  empresa_grande: number;
  site_proprio: number;
  sem_contato: number;
  sem_whatsapp: number;
}

const ROTULO_DESCARTE: Record<keyof Descartes, string> = {
  sem_whatsapp: 'sem WhatsApp',
  empresa_grande: 'empresa grande',
  site_proprio: 'têm site fora do Maps',
  sem_contato: 'sem nenhum contato',
};

const PREFS = 'vl-busca';

function lerPrefs(): { nichos: string[]; extras: string[]; cidade: string; bairros: string } {
  try {
    return { nichos: [], extras: [], cidade: '', bairros: '', ...JSON.parse(localStorage.getItem(PREFS) || '{}') };
  } catch {
    return { nichos: [], extras: [], cidade: '', bairros: '' };
  }
}

interface Buscas {
  usadas: number;
  limite: number;
  periodo: string;
  ilimitado: boolean;
}

export default function BuscaGoogle({
  ligada,
  cotaInicial,
  buscasIniciais,
}: {
  ligada: boolean;
  cotaInicial: CotaJson;
  buscasIniciais: Buscas;
}) {
  const [cota, setCota] = useState<CotaJson>(cotaInicial);
  const [buscas, setBuscas] = useState<Buscas>(buscasIniciais);
  const [nichos, setNichos] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [novoNicho, setNovoNicho] = useState('');
  const [cidade, setCidade] = useState('');
  const [bairros, setBairros] = useState('');
  const max = cota.ilimitado ? 500 : Math.min(200, cota.restantes ?? 0);
  const [quero, setQuero] = useState(Math.min(30, max) || 1);
  const [soComWhatsapp, setSoComWhatsapp] = useState(true);
  const [descartes, setDescartes] = useState<Descartes>({ empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0 });
  const [rodando, setRodando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; fim?: boolean } | null>(null);
  const [terminou, setTerminou] = useState(false);
  const parar = useRef(false);

  useEffect(() => {
    const p = lerPrefs();
    setNichos(new Set(p.nichos));
    setExtras(p.extras);
    setCidade(p.cidade);
    setBairros(p.bairros);
  }, []);

  function guardar(n = nichos, e = extras, c = cidade, b = bairros) {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ nichos: [...n], extras: e, cidade: c, bairros: b }));
    } catch {}
  }

  const locais = (() => {
    const lista = bairros.split('\n').map((b) => b.trim()).filter(Boolean).slice(0, 30);
    return lista.length ? lista.map((b) => `${b}, ${cidade.trim()}`) : [cidade.trim()];
  })();
  const perguntas = nichos.size * locais.length;
  const totais = linhas.reduce(
    (t, l) => ({
      comercios: t.comercios + l.comercios,
      comSite: t.comSite + l.comSite,
      jaTinha: t.jaTinha + l.jaTinha,
      novos: t.novos + l.novos,
      descartados: t.descartados + l.descartados,
      confirmados: t.confirmados + l.confirmados,
    }),
    { comercios: 0, comSite: 0, jaTinha: 0, novos: 0, descartados: 0, confirmados: 0 },
  );
  const semCota = !cota.ilimitado && (cota.restantes ?? 0) <= 0;

  async function iniciar() {
    if (!nichos.size || cidade.trim().length < 2) {
      setAviso({ texto: 'Escolha pelo menos um nicho e escreva a cidade.' });
      return;
    }
    parar.current = false;
    setRodando(true);
    setTerminou(false);
    setAviso(null);
    setLinhas([]);
    setDescartes({ empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0 });
    let faltam = quero;

    fora: for (const nicho of nichos) {
      for (const local of locais) {
        let pagina: string | null = null;
        let n = 0;
        do {
          if (parar.current || faltam <= 0) break fora;
          n++;
          let r;
          try {
            r = await fetch('/api/busca', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nicho, local, pagina, quero: faltam, soComWhatsapp }),
            }).then((x) => x.json());
          } catch {
            setAviso({ texto: 'Falha de rede. Confira a internet e clique em Buscar de novo.' });
            break fora;
          }
          if (r.cota) setCota(r.cota);
          if (r.buscas) setBuscas((b) => ({ ...b, usadas: r.buscas.usadas, limite: r.buscas.limite }));
          if (!r.ok) {
            setAviso({ texto: r.erro || 'A busca falhou.', fim: r.fim });
            if (r.fim || !r.erro) break fora;
            break; // erro desta pergunta: segue para a próxima
          }
          if (r.jaFeita) {
            const pulada: Linha = { chave: `${nicho}|${local}|pulada`, pergunta: `${nicho} em ${local}`, pagina: 0, comercios: 0, comSite: 0, jaTinha: 0, novos: 0, descartados: 0, confirmados: 0, nota: 'pulada' };
            setLinhas((l) => [...l, pulada]);
            break; // próxima pergunta
          }
          faltam -= r.novos;
          // a linha é montada já, com o número desta página: o React aplica depois
          const linha: Linha = { chave: `${nicho}|${local}|${n}`, pergunta: `${nicho} em ${local}`, pagina: n, comercios: r.comercios, comSite: r.comSite, jaTinha: r.jaTinha, novos: r.novos, descartados: Object.values((r.descartados || {}) as Record<string, number>).reduce((a, b) => a + b, 0), confirmados: r.comWhatsappLink || 0, nota: r.retomada ? 'continuou' : undefined };
          if (r.descartados) setDescartes((d) => ({ empresa_grande: d.empresa_grande + (r.descartados.empresa_grande || 0), site_proprio: d.site_proprio + (r.descartados.site_proprio || 0), sem_contato: d.sem_contato + (r.descartados.sem_contato || 0), sem_whatsapp: d.sem_whatsapp + (r.descartados.sem_whatsapp || 0) }));
          setLinhas((l) => [...l, linha]);
          if (r.fim) break fora;
          pagina = r.proxima;
        } while (pagina);
      }
    }
    setRodando(false);
    setTerminou(true);
  }

  if (!ligada) {
    return (
      <div className="mt-9 rounded-[24px] bg-zinc-100 p-7">
        <h2 className="text-[19px] font-extrabold">A busca está fora do ar agora</h2>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-zinc-700">
          Não consegui falar com o Google neste momento. Seus leads, o CRM e as propostas continuam funcionando normalmente.
          Tente de novo em alguns minutos; se continuar, responda qualquer e-mail nosso que a gente resolve.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------- formulário */}
      <form
        className="space-y-6 rounded-[24px] border border-zinc-200 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rodando) iniciar();
        }}
      >
        <fieldset disabled={rodando}>
          <legend className="text-[15px] font-extrabold">1. O que procurar</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...NICHOS_PADRAO, ...extras].map((n) => {
              const on = nichos.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setNichos((atual) => {
                      const s = new Set(atual);
                      if (s.has(n)) s.delete(n);
                      else s.add(n);
                      guardar(s);
                      return s;
                    })
                  }
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition-colors ${
                    on ? 'bg-tinta text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {on && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />}
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={novoNicho}
              onChange={(e) => setNovoNicho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click();
                }
              }}
              maxLength={60}
              placeholder="Outro nicho, ex.: Lava-jato"
              aria-label="Outro nicho"
              className="min-w-0 flex-1 rounded-full bg-zinc-100 px-4 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-tinta"
            />
            <button
              type="button"
              onClick={() => {
                const n = novoNicho.trim();
                if (!n) return;
                const e = extras.includes(n) || NICHOS_PADRAO.includes(n) ? extras : [...extras, n];
                const s = new Set(nichos).add(n);
                setExtras(e);
                setNichos(s);
                setNovoNicho('');
                guardar(s, e);
              }}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full border border-zinc-200 px-3.5 text-[12.5px] font-bold hover:border-zinc-400"
            >
              <Plus aria-hidden className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </fieldset>

        <fieldset disabled={rodando} className="grid gap-4 md:grid-cols-2">
          <legend className="mb-3 text-[15px] font-extrabold">2. Onde</legend>
          <label className="block">
            <span className="text-[12.5px] font-bold">Cidade</span>
            <input
              value={cidade}
              onChange={(e) => {
                setCidade(e.target.value);
                guardar(undefined, undefined, e.target.value);
              }}
              maxLength={60}
              placeholder="Ex.: Gurupi - TO"
              className="mt-1.5 w-full rounded-full bg-zinc-100 px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-tinta"
            />
          </label>
          <label className="block md:row-span-2">
            <span className="text-[12.5px] font-bold">Bairros (opcional, um por linha)</span>
            <textarea
              value={bairros}
              onChange={(e) => {
                setBairros(e.target.value);
                guardar(undefined, undefined, undefined, e.target.value);
              }}
              rows={4}
              placeholder={'Centro\nSetor Aeroporto\nJardim Tocantins'}
              className="mt-1.5 w-full resize-y rounded-[18px] bg-zinc-100 px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-tinta"
            />
          </label>
          <p className="text-[12px] leading-relaxed text-zinc-500">
            O Google mostra no máximo 60 comércios por busca. Em cidade grande, liste os bairros para achar mais.
          </p>
        </fieldset>

        <fieldset disabled={rodando}>
          <legend className="text-[15px] font-extrabold">3. Quantos leads</legend>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={Math.max(1, max)}
              value={quero}
              onChange={(e) => setQuero(Math.max(1, Math.min(Math.max(1, max), Math.floor(Number(e.target.value) || 1))))}
              aria-label="Quantos leads"
              className="w-28 rounded-full bg-zinc-100 px-4 py-2.5 text-[15px] font-bold tabular-nums outline-none focus:ring-2 focus:ring-tinta"
            />
            <p className="text-[12.5px] text-zinc-500">
              {cota.ilimitado
                ? 'Sua conta não tem limite.'
                : cota.teste
                  ? `Restam ${cota.restantes ?? 0} do seu teste grátis.`
                  : `Restam ${cota.restantes ?? 0} nesta semana.`}
              {!buscas.ilimitado && (
                <>
                  <br />
                  Buscas no Google {buscas.periodo}: <b className="text-tinta">{Math.min(buscas.usadas, buscas.limite)} de {buscas.limite}</b>
                </>
              )}
            </p>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[18px] bg-menta/60 px-4 py-3">
            <input
              type="checkbox"
              checked={soComWhatsapp}
              onChange={(e) => setSoComWhatsapp(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#0b0b0f]"
            />
            <span>
              <span className="block text-[13px] font-bold">Só com WhatsApp</span>
              <span className="block text-[12px] leading-relaxed text-zinc-600">
                Quem só tem telefone fixo e nenhum link com WhatsApp fica de fora e não gasta sua cota.
              </span>
            </span>
          </label>
        </fieldset>

        {aviso && (
          <p role="alert" className={`rounded-2xl px-4 py-3 text-[13px] font-semibold ${aviso.fim ? 'bg-tinta text-white' : 'bg-zinc-100'}`}>
            {aviso.texto}
            {aviso.fim && (
              <a href="/planos" className="ml-2 underline underline-offset-2">Ver planos</a>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {rodando ? (
            <button
              type="button"
              onClick={() => (parar.current = true)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-rosa px-6 text-[14px] font-extrabold text-red-950 hover:brightness-95"
            >
              <Square aria-hidden className="h-4 w-4" fill="currentColor" /> Parar
            </button>
          ) : (
            <button
              type="submit"
              disabled={semCota}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-tinta px-6 text-[14px] font-extrabold text-white hover:bg-tinta-70 disabled:opacity-40"
            >
              <Play aria-hidden className="h-4 w-4" fill="currentColor" /> Buscar
            </button>
          )}
          {!rodando && nichos.size > 0 && cidade.trim() && (
            <p className="text-[12.5px] text-zinc-500">
              {perguntas} {perguntas === 1 ? 'busca' : 'buscas'} ({nichos.size} {nichos.size === 1 ? 'nicho' : 'nichos'} × {locais.length}{' '}
              {locais.length === 1 ? 'lugar' : 'lugares'}), até juntar {quero} {quero === 1 ? 'lead' : 'leads'}.
            </p>
          )}
          {semCota && !rodando && (
            <a href="/planos" className="text-[13px] font-bold underline underline-offset-2">
              {cota.teste ? 'Seu teste acabou: ver planos' : 'Cota da semana usada: ver planos'}
            </a>
          )}
        </div>
      </form>

      {/* -------------------------------------------------- progresso */}
      <section aria-live="polite" className="flex flex-col rounded-[24px] bg-zinc-50 p-6">
        <h2 className="text-[15px] font-extrabold">Resultado</h2>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { rotulo: 'Leads novos', valor: totais.novos, fundo: 'bg-menta' },
            { rotulo: 'Já tinham site', valor: totais.comSite, fundo: 'bg-white' },
            { rotulo: 'Descartados', valor: totais.descartados, fundo: 'bg-white' },
            { rotulo: 'Repetidos (não contam)', valor: totais.jaTinha, fundo: 'bg-white' },
          ].map((k) => (
            <div key={k.rotulo} className={`rounded-[18px] px-3.5 py-3 ${k.fundo}`}>
              <p className="text-[24px] font-extrabold leading-none tabular-nums">{k.valor}</p>
              <p className="mt-1 text-[11.5px] font-bold text-zinc-600">{k.rotulo}</p>
            </div>
          ))}
        </div>

        {(totais.descartados > 0 || totais.confirmados > 0) && (
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-600">
            {totais.confirmados > 0 && (
              <>
                <b className="text-emerald-800">{totais.confirmados}</b> com WhatsApp confirmado no link da própria empresa.{' '}
              </>
            )}
            {totais.descartados > 0 && (
              <>
                Descartados:{' '}
                {(Object.keys(ROTULO_DESCARTE) as (keyof Descartes)[])
                  .filter((k) => descartes[k] > 0)
                  .map((k) => `${descartes[k]} ${ROTULO_DESCARTE[k]}`)
                  .join(' · ')}
                .
              </>
            )}
          </p>
        )}

        <ol className="mt-4 max-h-[340px] flex-1 space-y-1.5 overflow-y-auto">
          {linhas.map((l) => (
            <li key={l.chave} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 text-[12.5px]">
              <span className="min-w-0 truncate font-semibold">
                {l.pergunta}
                {l.nota === 'continuou' ? (
                  <span className="text-zinc-400"> · continuou de onde parou</span>
                ) : (
                  l.pagina > 1 && <span className="text-zinc-400"> · pág. {l.pagina}</span>
                )}
              </span>
              {l.nota === 'pulada' ? (
                <span className="shrink-0 text-zinc-500">já buscada até o fim · sem gastar</span>
              ) : (
                <span className="shrink-0 tabular-nums text-zinc-500">
                  <b className="text-tinta">+{l.novos}</b> de {l.comercios}
                </span>
              )}
            </li>
          ))}
          {rodando && (
            <li className="flex items-center gap-2 px-1 py-2 text-[12.5px] font-semibold text-zinc-500">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Buscando no Google…
            </li>
          )}
          {!linhas.length && !rodando && (
            <li className="px-1 py-6 text-center text-[13px] text-zinc-500">Escolha os nichos e a cidade e clique em Buscar.</li>
          )}
        </ol>

        {terminou && totais.novos > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/" className="inline-flex min-h-[42px] items-center rounded-full bg-tinta px-5 text-[13px] font-bold text-white hover:bg-tinta-70">
              Ver no painel
            </a>
            <a href="/crm" className="inline-flex min-h-[42px] items-center rounded-full border border-zinc-300 bg-white px-5 text-[13px] font-bold hover:border-zinc-500">
              Abrir o CRM
            </a>
          </div>
        )}
        {terminou && totais.novos === 0 && linhas.length > 0 && (
          <p className="mt-4 text-[13px] text-zinc-600">
            {linhas.every((l) => l.nota === 'pulada')
              ? 'Você já fez essas buscas até o fim, então nada foi gasto. Para achar leads novos, liste bairros da cidade ou escolha outros nichos.'
              : 'Nenhum comércio novo sem site nessa busca. Tente outros nichos ou liste bairros da cidade.'}
          </p>
        )}
      </section>
    </div>
  );
}
