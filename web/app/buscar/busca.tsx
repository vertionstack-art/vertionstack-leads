'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Play, Plus, Square } from 'lucide-react';
import type { ResumoBuscas } from '@/lib/google-places';
import { NICHOS_EXTERIOR, PAISES_EXTERIOR } from '@/lib/exterior';

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
  /** tinham site no ar, mas fraco (nota até 6), e entraram */
  fracos?: number;
  /** 'pulada': já buscada até o fim, sem chamar o Google; 'continuou': retomou de onde parou */
  nota?: 'pulada' | 'continuou';
}

interface Descartes {
  empresa_grande: number;
  site_proprio: number;
  sem_contato: number;
  sem_whatsapp: number;
  fora_do_perfil: number;
  sem_email: number;
  pouco_movimento: number;
}

const DESCARTES_ZERADOS: Descartes = { empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0, fora_do_perfil: 0, sem_email: 0, pouco_movimento: 0 };

type Modo = 'brasil' | 'exterior';

const ROTULO_DESCARTE: Record<keyof Descartes, string> = {
  sem_whatsapp: 'sem WhatsApp',
  empresa_grande: 'empresa grande',
  site_proprio: 'têm site fora do Maps',
  sem_contato: 'sem nenhum contato',
  fora_do_perfil: 'não combinam com o que você vende',
  sem_email: 'sem e-mail nem WhatsApp',
  pouco_movimento: 'pouco movimento (menos de 10 avaliações ou nota abaixo de 4)',
};

const PREFS: Record<Modo, string> = { brasil: 'vl-busca', exterior: 'vl-busca-exterior' };
const PREF_MODO = 'vl-busca-modo';

interface Prefs { nichos: string[]; extras: string[]; cidade: string; bairros: string; pais: string }

function lerPrefs(modo: Modo): Prefs {
  const vazio: Prefs = { nichos: [], extras: [], cidade: '', bairros: '', pais: 'US' };
  try {
    return { ...vazio, ...JSON.parse(localStorage.getItem(PREFS[modo]) || '{}') };
  } catch {
    return vazio;
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
  resumoInicial,
  trava: travaInicial,
}: {
  ligada: boolean;
  cotaInicial: CotaJson;
  buscasIniciais: Buscas;
  /** buscas feitas hoje, na semana, no mês e desde o começo (lib/google-places) */
  resumoInicial: ResumoBuscas;
  /** a trava da ferramenta inteira (só para a conta da Vertion e o administrador) */
  trava: Trava | null;
}) {
  const [resumo, setResumo] = useState<ResumoBuscas>(resumoInicial);
  const [trava, setTrava] = useState<Trava | null>(travaInicial);
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
  const [modo, setModo] = useState<Modo>('brasil');
  const [pais, setPais] = useState('US');
  const [soComEmail, setSoComEmail] = useState(false);
  const [soBemAvaliados, setSoBemAvaliados] = useState(true);
  const [siteFraco, setSiteFraco] = useState(true);
  const [descartes, setDescartes] = useState<Descartes>(DESCARTES_ZERADOS);
  const [rodando, setRodando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; fim?: boolean } | null>(null);
  const [terminou, setTerminou] = useState(false);
  const parar = useRef(false);

  function carregar(m: Modo) {
    const p = lerPrefs(m);
    setNichos(new Set(p.nichos));
    setExtras(p.extras);
    setCidade(p.cidade);
    setBairros(p.bairros);
    setPais(PAISES_EXTERIOR.some((x) => x.id === p.pais) ? p.pais : 'US');
  }

  useEffect(() => {
    let m: Modo = 'brasil';
    try {
      m = localStorage.getItem(PREF_MODO) === 'exterior' ? 'exterior' : 'brasil';
    } catch {}
    // lido uma vez, depois que a página abre (o servidor não tem localStorage)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModo(m);
    carregar(m);
  }, []);

  function guardar(n = nichos, e = extras, c = cidade, b = bairros, pa = pais) {
    try {
      localStorage.setItem(PREFS[modo], JSON.stringify({ nichos: [...n], extras: e, cidade: c, bairros: b, pais: pa }));
    } catch {}
  }

  function trocarModo(m: Modo) {
    if (m === modo) return;
    setModo(m);
    carregar(m);
    setLinhas([]);
    setAviso(null);
    setTerminou(false);
    try {
      localStorage.setItem(PREF_MODO, m);
    } catch {}
  }

  const exterior = modo === 'exterior';
  const paisAtual = PAISES_EXTERIOR.find((x) => x.id === pais) ?? PAISES_EXTERIOR[0];
  const nichosPadrao = exterior ? NICHOS_EXTERIOR.map((n) => n.en) : NICHOS_PADRAO;
  const rotuloNicho = (n: string) => (exterior ? NICHOS_EXTERIOR.find((x) => x.en === n)?.pt ?? n : n);

  // no exterior, cidade em branco = o país inteiro, cidade média por cidade média
  const paisInteiro = exterior && !cidade.trim();
  const locais = (() => {
    if (paisInteiro) return paisAtual.cidades;
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
      fracos: t.fracos + (l.fracos || 0),
    }),
    { comercios: 0, comSite: 0, jaTinha: 0, novos: 0, descartados: 0, confirmados: 0, fracos: 0 },
  );
  const semCota = !cota.ilimitado && (cota.restantes ?? 0) <= 0;

  async function iniciar() {
    if (!nichos.size || (!paisInteiro && cidade.trim().length < 2)) {
      setAviso({ texto: exterior ? 'Escolha pelo menos um nicho.' : 'Escolha pelo menos um nicho e escreva a cidade.' });
      return;
    }
    parar.current = false;
    setRodando(true);
    setTerminou(false);
    setAviso(null);
    setLinhas([]);
    setDescartes(DESCARTES_ZERADOS);
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
              body: JSON.stringify(
                exterior
                  ? { nicho, local, pagina, quero: faltam, siteFraco, pais, soComEmail, soBemAvaliados }
                  : { nicho, local, pagina, quero: faltam, soComWhatsapp, siteFraco },
              ),
            }).then((x) => x.json());
          } catch {
            setAviso({ texto: 'Falha de rede. Confira a internet e clique em Buscar de novo.' });
            break fora;
          }
          if (r.cota) setCota(r.cota);
          // cada resposta boa que não foi pulada é uma chamada ao Google a mais no contador
          if (r.ok && !r.jaFeita) {
            const novos = Number(r.novos) || 0;
            setResumo((x) => ({ ...x, hoje: x.hoje + 1, semana: x.semana + 1, mes: x.mes + 1, total: x.total + 1, leadsMes: x.leadsMes + novos, leadsTotal: x.leadsTotal + novos }));
            setTrava((x) => (x ? { ...x, hoje: x.hoje + 1, mes: x.mes + 1 } : x));
          }
          if (r.buscas) setBuscas((b) => ({ ...b, usadas: r.buscas.usadas, limite: r.buscas.limite }));
          if (!r.ok) {
            setAviso({ texto: r.erro || 'A busca falhou.', fim: r.fim });
            if (r.fim || !r.erro) break fora;
            break; // erro desta pergunta: segue para a próxima
          }
          if (r.jaFeita) {
            const pulada: Linha = { chave: `${nicho}|${local}|pulada`, pergunta: `${rotuloNicho(nicho)} ${exterior ? 'in' : 'em'} ${local}`, pagina: 0, comercios: 0, comSite: 0, jaTinha: 0, novos: 0, descartados: 0, confirmados: 0, nota: 'pulada' };
            setLinhas((l) => [...l, pulada]);
            break; // próxima pergunta
          }
          faltam -= r.novos;
          // a linha é montada já, com o número desta página: o React aplica depois
          const linha: Linha = { chave: `${nicho}|${local}|${n}`, pergunta: `${rotuloNicho(nicho)} ${exterior ? 'in' : 'em'} ${local}${r.traduzido ? ` (buscou “${r.traduzido}”)` : ''}`, pagina: n, comercios: r.comercios, comSite: r.comSite, jaTinha: r.jaTinha, novos: r.novos, descartados: Object.values((r.descartados || {}) as Record<string, number>).reduce((a, b) => a + b, 0), confirmados: (exterior ? r.comEmail : r.comWhatsappLink) || 0, fracos: r.sitesFracos || 0, nota: r.retomada ? 'continuou' : undefined };
          if (r.descartados) setDescartes((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v + ((r.descartados as Record<string, number>)[k] || 0)])) as unknown as Descartes);
          setLinhas((l) => [...l, linha]);
          if (r.fim) break fora;
          pagina = r.proxima;
          // segunda trava: o Google só tem 3 páginas por pergunta
          if (n >= 3) break;
        } while (pagina);
      }
    }
    setRodando(false);
    setTerminou(true);
  }

  const quadro = <QuadroBuscas resumo={resumo} buscas={buscas} trava={trava} />;

  if (!ligada) {
    return (
      <>
      {quadro}
      <div className="mt-6 rounded-[24px] bg-manteiga p-7">
        <h2 className="text-[19px] font-extrabold">A busca está fora do ar agora</h2>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-zinc-700">
          Não consegui falar com o Google neste momento. Seus leads, o CRM e as propostas continuam funcionando normalmente.
          Tente de novo em alguns minutos; se continuar, responda qualquer e-mail nosso que a gente resolve.
        </p>
      </div>
      </>
    );
  }

  return (
    <>
    {quadro}
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------- formulário */}
      <form
        className="space-y-6 rounded-[24px] border border-zinc-200 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rodando) iniciar();
        }}
      >
        <div role="radiogroup" aria-label="Onde buscar" className="grid grid-cols-2 gap-1.5 rounded-full bg-zinc-100 p-1.5">
          {(['brasil', 'exterior'] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              disabled={rodando}
              onClick={() => trocarModo(m)}
              className={`min-h-[40px] rounded-full text-[13.5px] font-extrabold transition-colors ${modo === m ? 'bg-tinta text-white' : 'text-zinc-600 hover:text-tinta'}`}
            >
              {m === 'brasil' ? 'Brasil · WhatsApp' : 'Exterior · e-mail'}
            </button>
          ))}
        </div>
        {exterior && (
          <p className="-mt-3 text-[12.5px] leading-relaxed text-zinc-600">
            Busca no Google do país escolhido, em inglês, e lê o site de cada empresa atrás do e-mail (página inicial e de contato).
            Os e-mails que vamos mandar saem em inglês.
          </p>
        )}

        <fieldset disabled={rodando}>
          <legend className="flex items-center gap-2.5 text-[16px] font-extrabold"><span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ceu text-[13px] font-extrabold">1</span>O que procurar</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...nichosPadrao, ...extras].map((n) => {
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
                  {rotuloNicho(n)}
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
              placeholder={exterior ? 'Outro nicho, pode ser em português. Ex.: limpeza de piscina' : 'Outro nicho, ex.: Lava-jato'}
              aria-label="Outro nicho"
              className="min-w-0 flex-1 rounded-full bg-zinc-100 px-4 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-tinta"
            />
            <button
              type="button"
              onClick={() => {
                const n = novoNicho.trim();
                if (!n) return;
                const e = extras.includes(n) || nichosPadrao.includes(n) ? extras : [...extras, n];
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
          <legend className="mb-3 flex items-center gap-2.5 text-[16px] font-extrabold"><span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-manteiga text-[13px] font-extrabold">2</span>Onde</legend>
          {exterior && (
            <label className="block">
              <span className="text-[12.5px] font-bold">País</span>
              <select
                value={pais}
                onChange={(e) => {
                  setPais(e.target.value);
                  guardar(undefined, undefined, undefined, undefined, e.target.value);
                }}
                className="mt-1.5 w-full rounded-full bg-zinc-100 px-4 py-2.5 text-[14px] font-semibold outline-none focus:ring-2 focus:ring-tinta"
              >
                {PAISES_EXTERIOR.map((x) => (
                  <option key={x.id} value={x.id}>{x.nome}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[12.5px] font-bold">{exterior ? 'Cidade (opcional)' : 'Cidade'}</span>
            <input
              value={cidade}
              onChange={(e) => {
                setCidade(e.target.value);
                guardar(undefined, undefined, e.target.value);
              }}
              maxLength={60}
              placeholder={exterior ? `Em branco = ${paisAtual.nome} inteiro` : 'Ex.: Gurupi - TO'}
              className="mt-1.5 w-full rounded-full bg-zinc-100 px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-tinta"
            />
          </label>
          <label className="block md:row-span-2">
            <span className="text-[12.5px] font-bold">{exterior ? 'Bairros ou regiões (opcional, um por linha)' : 'Bairros (opcional, um por linha)'}</span>
            <textarea
              value={bairros}
              onChange={(e) => {
                setBairros(e.target.value);
                guardar(undefined, undefined, undefined, e.target.value);
              }}
              rows={4}
              placeholder={exterior ? paisAtual.exemploBairros : 'Centro\nSetor Aeroporto\nJardim Tocantins'}
              className="mt-1.5 w-full resize-y rounded-[18px] bg-zinc-100 px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-tinta"
            />
          </label>
          {exterior && (
            <div className="flex flex-wrap gap-1.5 md:col-span-1">
              {paisAtual.cidades.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCidade(c);
                    guardar(undefined, undefined, c);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${cidade === c ? 'bg-tinta text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <p className="text-[12px] leading-relaxed text-zinc-500">
            {exterior &&
              (paisInteiro
                ? `País inteiro: a busca passa pelas ${paisAtual.cidades.length} cidades médias de ${paisAtual.nome} (as da lista acima), uma por uma. `
                : 'Deixe a cidade em branco para buscar no país inteiro. Cidade média rende mais que capital: muito comércio local e menos gente oferecendo site. ')}
            O Google mostra no máximo 60 comércios por busca. Em cidade grande, liste os bairros para achar mais.
          </p>
        </fieldset>

        <fieldset disabled={rodando}>
          <legend className="flex items-center gap-2.5 text-[16px] font-extrabold"><span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-menta text-[13px] font-extrabold">3</span>Quantos leads</legend>
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
                ? `Sua conta não tem limite. Buscas no Google este mês: ${resumo.mes}.`
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
          {exterior ? (
            <>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[18px] bg-menta/60 px-4 py-3">
                <input type="checkbox" checked={soComEmail} onChange={(e) => setSoComEmail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b0b0f]" />
                <span>
                  <span className="block text-[13px] font-bold">Só os que já vêm com e-mail</span>
                  <span className="block text-[12px] leading-relaxed text-zinc-600">
                    Desligado, quem não tem e-mail no site entra também, e no cartão do lead aparece um campo para você colar o e-mail que achar no Instagram ou no Facebook.
                  </span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-[18px] bg-manteiga/70 px-4 py-3">
                <input type="checkbox" checked={soBemAvaliados} onChange={(e) => setSoBemAvaliados(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b0b0f]" />
                <span>
                  <span className="block text-[13px] font-bold">Só negócios com movimento</span>
                  <span className="block text-[12px] leading-relaxed text-zinc-600">
                    10 avaliações ou mais e nota 4 ou mais no Google: negócio que existe, tem cliente e tem como pagar por um site.
                  </span>
                </span>
              </label>
            </>
          ) : (
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
          )}
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-[18px] bg-ceu/70 px-4 py-3">
            <input
              type="checkbox"
              checked={siteFraco}
              onChange={(e) => setSiteFraco(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#0b0b0f]"
            />
            <span>
              <span className="block text-[13px] font-bold">Trazer quem tem site fraco (nota até 6)</span>
              <span className="block text-[12px] leading-relaxed text-zinc-600">
                {exterior
                  ? 'Quem tem site no ar ganha uma nota de 0 a 10 (contato direto, telefone clicável, formulário ou agendamento, celular, cadeado…). Até 6 vira lead, com os problemas anotados.'
                  : 'Quem tem site no ar ganha uma nota de 0 a 10 (botão de WhatsApp, telefone clicável, formulário, celular, cadeado…). Até 6 vira lead, com os problemas anotados.'}
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
          {!rodando && nichos.size > 0 && (cidade.trim() || paisInteiro) && (
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
      <section aria-live="polite" className="flex flex-col rounded-[24px] bg-lavanda p-6">
        <h2 className="text-[16px] font-extrabold">Resultado</h2>
        {totais.fracos > 0 && (
          <p className="mt-2 text-[12.5px] font-semibold text-zinc-700">
            {totais.fracos} dos leads novos {totais.fracos === 1 ? 'tinha' : 'tinham'} site no ar, mas fraco (nota até 6).
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { rotulo: 'Leads novos', valor: totais.novos, fundo: 'bg-menta' },
            { rotulo: 'Já tinham site bom', valor: totais.comSite, fundo: 'bg-white' },
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
                <b className="text-emerald-800">{totais.confirmados}</b> {exterior ? 'com e-mail da própria empresa, conferido.' : 'com WhatsApp confirmado no link da própria empresa.'}{' '}
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
    </>
  );
}

const num = (n: number) => n.toLocaleString('pt-BR');

interface Trava {
  hoje: number;
  tetoDia: number;
  mes: number;
  tetoMes: number;
  gratisGoogle: number;
}

function Restam({ rotulo, usadas, teto, nota }: { rotulo: string; usadas: number; teto: number; nota: string }) {
  const restam = Math.max(0, teto - usadas);
  const pct = Math.min(100, teto > 0 ? (usadas / teto) * 100 : 0);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold">{rotulo}</span>
        <span className="text-[13px] tabular-nums">
          <b className="text-[18px] font-extrabold">{num(restam)}</b> <span className="text-zinc-600">de {num(teto)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${rotulo}: restam ${restam} de ${teto}`}
        aria-valuemin={0}
        aria-valuemax={teto}
        aria-valuenow={restam}
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white"
      >
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-amber-500' : 'bg-tinta'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11.5px] font-medium text-zinc-600">{nota}</p>
    </div>
  );
}

/** "Suas buscas no Google": hoje, 7 dias, mês e desde o começo, com os leads que renderam, e o que ainda resta */
function QuadroBuscas({ resumo, buscas, trava }: { resumo: ResumoBuscas; buscas: Buscas; trava: Trava | null }) {
  const blocos = [
    { rotulo: 'Hoje', valor: resumo.hoje, detalhe: null, fundo: 'bg-ceu' },
    { rotulo: 'Últimos 7 dias', valor: resumo.semana, detalhe: null, fundo: 'bg-manteiga' },
    { rotulo: 'Este mês', valor: resumo.mes, detalhe: `${num(resumo.leadsMes)} leads novos`, fundo: 'bg-lavanda' },
    { rotulo: 'Desde o começo', valor: resumo.total, detalhe: `${num(resumo.leadsTotal)} leads novos`, fundo: 'bg-menta' },
  ];
  return (
    <section aria-labelledby="t-suas-buscas" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="t-suas-buscas" className="text-[17px] font-extrabold tracking-[-0.01em]">Suas buscas no Google</h2>
        <p className="text-[12px] font-medium text-zinc-500">Cada página de resultados do Google conta como uma busca.</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {blocos.map((b) => (
          <div key={b.rotulo} className={`rounded-[22px] ${b.fundo} px-5 py-4`}>
            <p className="text-[12.5px] font-bold text-tinta/70">{b.rotulo}</p>
            <p className="mt-1.5 text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{num(b.valor)}</p>
            <p className="mt-1.5 text-[12px] font-semibold text-tinta/60">
              {b.detalhe ?? (b.valor === 1 ? 'busca' : 'buscas')}
            </p>
          </div>
        ))}
      </div>
      {(trava || !buscas.ilimitado) && (
        <div className="mt-3 rounded-[22px] bg-zinc-100 px-5 py-4">
          <p className="text-[14px] font-extrabold">Ainda dá para buscar</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:gap-8">
            {!buscas.ilimitado && (
              <Restam rotulo={`No seu plano (${buscas.periodo})`} usadas={buscas.usadas} teto={buscas.limite} nota="O limite de buscas do seu plano." />
            )}
            {trava && (
              <>
                <Restam
                  rotulo="Hoje, na ferramenta inteira"
                  usadas={trava.hoje}
                  teto={trava.tetoDia}
                  nota="Trava diária de todos os usuários juntos. Zera à meia-noite."
                />
                <Restam
                  rotulo="Este mês, na ferramenta inteira"
                  usadas={trava.mes}
                  teto={trava.tetoMes}
                  nota={`O Google dá ${num(trava.gratisGoogle)} buscas grátis por mês; a trava para antes, para não gerar cobrança.`}
                />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
