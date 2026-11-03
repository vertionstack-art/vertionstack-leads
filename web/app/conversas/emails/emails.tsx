'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, MessageSquareReply, RotateCcw, Send, Sparkles, Undo2, X } from 'lucide-react';
import { CLASSE_NIVEL, type Nivel } from '@/lib/temperatura';
import type { CandidatoEmail, EmailNaFila } from '@/lib/email-frio-fila';
import { comPreco, lerValor, moedaDoLead, MOEDAS, type Moeda } from '@/lib/preco-email';

/**
 * Três tempos, como na fila do WhatsApp: marque as empresas, clique em
 * "Escrever e-mails" (a IA escreve um por vez) e vá lendo e aprovando.
 * Aprovado entra na fila de envio, que sai sozinha no horário comercial do
 * país de cada empresa, no máximo o teto do dia. Até sair, dá para voltar.
 */

const ROTULO_NIVEL: Record<Nivel, string> = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };

/** a resposta que chegou, como aparece na lista de enviados */
const RESPOSTA: Record<string, { rotulo: string; fundo: string }> = {
  interessado: { rotulo: 'Interessado', fundo: 'bg-menta' },
  pergunta: { rotulo: 'Fez uma pergunta', fundo: 'bg-ceu' },
  sem_interesse: { rotulo: 'Sem interesse', fundo: 'bg-zinc-100' },
  descadastro: { rotulo: 'Pediu para não receber', fundo: 'bg-zinc-100' },
  devolvido: { rotulo: 'E-mail voltou', fundo: 'bg-rosa' },
  outro: { rotulo: 'Respondeu', fundo: 'bg-manteiga' },
};

const CIDADE_DO_FUSO: Record<string, string> = {
  'America/New_York': 'Nova York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Phoenix': 'Phoenix',
  'America/Los_Angeles': 'Los Angeles',
  'America/Halifax': 'Halifax',
  'Europe/London': 'Londres',
  'Europe/Dublin': 'Dublin',
  'Australia/Sydney': 'Sydney',
  'Australia/Brisbane': 'Brisbane',
  'Australia/Adelaide': 'Adelaide',
  'Australia/Perth': 'Perth',
  'Pacific/Auckland': 'Auckland',
};

/** "qua 05/11, 10:00 (sua hora)" */
function quando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

async function chamar(url: string, metodo: 'POST' | 'DELETE', body?: unknown) {
  const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => ({ ok: false, erro: 'Falha de rede.' }));
}

export default function Emails({
  candidatosIniciais,
  emailsIniciais,
  enviadosHoje,
  teto,
  gmail,
  ia,
}: {
  candidatosIniciais: CandidatoEmail[];
  emailsIniciais: EmailNaFila[];
  enviadosHoje: number;
  teto: number;
  gmail: boolean;
  ia: boolean;
}) {
  const [candidatos, setCandidatos] = useState(candidatosIniciais);
  const [emails, setEmails] = useState(emailsIniciais);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);

  const rascunhos = useMemo(() => emails.filter((e) => e.status === 'rascunho' || e.status === 'erro'), [emails]);
  const naFila = useMemo(() => emails.filter((e) => e.status === 'aprovado' || e.status === 'enviando'), [emails]);
  const enviados = useMemo(() => emails.filter((e) => e.status === 'enviado'), [emails]);

  function trocar(e: EmailNaFila) {
    setEmails((lista) => [e, ...lista.filter((x) => x.id !== e.id && x.leadId !== e.leadId)]);
  }

  async function escrever() {
    setAviso(null);
    for (const id of [...marcados]) {
      setGerando(id);
      const r = await chamar('/api/email-frio', 'POST', { leadId: id });
      if (r.ok) {
        trocar(r.email);
        setCandidatos((c) => c.filter((x) => x.id !== id));
        setMarcados((m) => {
          const n = new Set(m);
          n.delete(id);
          return n;
        });
      } else {
        setAviso(r.erro || 'Não consegui escrever um dos e-mails.');
        break;
      }
    }
    setGerando(null);
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ------------------------------------------------- situação */}
      <section className="grid gap-2.5 sm:grid-cols-3">
        <div className={`rounded-[18px] px-4 py-3 ${gmail ? 'bg-menta' : 'bg-rosa'}`}>
          <p className="text-[13px] font-extrabold">{gmail ? 'Gmail ligado' : 'Gmail ainda não ligado'}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-700">
            {gmail ? 'Os aprovados saem por vertionstack@gmail.com.' : 'Você já pode escrever e aprovar; o envio começa quando a senha de app estiver na Vercel.'}
          </p>
          {gmail && (
            <button
              type="button"
              disabled={testando}
              onClick={async () => {
                setTestando(true);
                setAviso(null);
                const r = await chamar('/api/email-frio/teste', 'POST');
                setTestando(false);
                setAviso(r.ok ? r.msg : r.erro || 'O teste falhou.');
              }}
              className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-tinta hover:bg-zinc-50 disabled:opacity-50"
            >
              {testando ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Send aria-hidden className="h-3.5 w-3.5" />}
              Mandar teste para mim
            </button>
          )}
        </div>
        <div className="rounded-[18px] bg-lavanda px-4 py-3">
          <p className="text-[13px] font-extrabold tabular-nums">Hoje: {enviadosHoje} de {teto} enviados</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-700">O teto protege o seu Gmail de cair no spam.</p>
        </div>
        <div className="rounded-[18px] bg-manteiga px-4 py-3">
          <p className="text-[13px] font-extrabold">Saem das 9h às 11h30 de lá</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-700">De segunda a sexta, no fuso de cada empresa. Assinatura e rodapé entram sozinhos.</p>
        </div>
      </section>

      {aviso && (
        <p role="alert" className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold ${aviso.startsWith('Mandei') ? 'bg-menta text-emerald-950' : 'bg-rosa text-red-950'}`}>
          {aviso.startsWith('Mandei') ? <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />} {aviso}
        </p>
      )}

      {/* ------------------------------------------------- 1. escolher */}
      <section className="rounded-[24px] border border-zinc-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-extrabold">1. Empresas com e-mail, ainda sem contato <span className="text-zinc-400">({candidatos.length})</span></h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!gerando || !candidatos.length}
              onClick={() => setMarcados(new Set(candidatos.slice(0, 5).map((c) => c.id)))}
              className="min-h-[38px] rounded-full bg-zinc-100 px-4 text-[12.5px] font-bold hover:bg-zinc-200 disabled:opacity-40"
            >
              Marcar 5 mais quentes
            </button>
            <button
              type="button"
              disabled={!!gerando || !marcados.size || !ia}
              onClick={escrever}
              title={ia ? undefined : 'Falta configurar a IA na Vercel'}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white hover:bg-tinta-70 disabled:opacity-40"
            >
              {gerando ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
              {gerando ? 'Escrevendo…' : `Escrever ${marcados.size || ''} e-mail${marcados.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
        {candidatos.length ? (
          <ul className="mt-3 max-h-[360px] space-y-1.5 overflow-y-auto">
            {candidatos.map((c) => (
              <li key={c.id}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${marcados.has(c.id) ? 'bg-lavanda' : 'bg-zinc-50 hover:bg-zinc-100'}`}>
                  <input
                    type="checkbox"
                    checked={marcados.has(c.id)}
                    disabled={!!gerando}
                    onChange={() =>
                      setMarcados((m) => {
                        const n = new Set(m);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                    className="h-4 w-4 accent-[#0b0b0f]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">
                      {c.nome}
                      {gerando === c.id && <Loader2 aria-label="escrevendo" className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                    </span>
                    <span className="block truncate text-[12px] text-zinc-500">
                      {[c.cidade, c.email, `porte ${c.porte.toLowerCase()}`, c.avaliacoes ? `${c.avaliacoes} avaliações` : null, c.siteNota !== null ? `site nota ${String(c.siteNota).replace('.', ',')}` : 'sem site', c.temConcorrente ? 'tem concorrente para citar' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${CLASSE_NIVEL[c.nivel]}`}>{ROTULO_NIVEL[c.nivel]}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
            Nenhuma empresa do exterior com e-mail esperando. Busque leads em <b>Buscar leads → Exterior</b>, ou adicione o e-mail no cartão de quem veio sem.
          </p>
        )}
      </section>

      {/* ------------------------------------------------- 2. ler e aprovar */}
      <section>
        <h2 className="text-[16px] font-extrabold">2. Ler e aprovar <span className="text-zinc-400">({rascunhos.length})</span></h2>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {rascunhos.map((e) => (
            <Rascunho key={e.id + e.assunto} email={e} aoMudar={trocar} aoTirar={(id) => setEmails((l) => l.filter((x) => x.id !== id))} />
          ))}
          {!rascunhos.length && <p className="text-[13px] text-zinc-500">Os e-mails escritos aparecem aqui para você ler antes de aprovar.</p>}
        </div>
      </section>

      {/* ------------------------------------------------- 3. na fila */}
      <section className="rounded-[24px] bg-zinc-50 p-5">
        <h2 className="text-[16px] font-extrabold">3. Aprovados, esperando o horário de lá <span className="text-zinc-400">({naFila.length})</span></h2>
        <ul className="mt-3 space-y-1.5">
          {naFila.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 text-[13px]">
              <Clock aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{e.nome}</b>
                <span className="block truncate text-[12px] text-zinc-500">
                  “{e.assunto}” · {e.status === 'enviando' ? 'saindo agora' : e.saiEm ? `sai a partir de ${quando(e.saiEm)} (sua hora), 9h em ${CIDADE_DO_FUSO[e.fuso] || e.fuso}` : ''}
                </span>
              </span>
              {e.status === 'aprovado' && (
                <button
                  type="button"
                  onClick={async () => {
                    const r = await chamar(`/api/email-frio/${e.id}`, 'POST', { acao: 'voltar' });
                    if (r.ok) trocar(r.email);
                    else setAviso(r.erro);
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-zinc-200 px-3 text-[12px] font-bold hover:border-zinc-400"
                >
                  <Undo2 aria-hidden className="h-3.5 w-3.5" /> Voltar para rascunho
                </button>
              )}
            </li>
          ))}
          {!naFila.length && <li className="text-[13px] text-zinc-500">Nada esperando. O que você aprovar aparece aqui com o horário de saída.</li>}
        </ul>
      </section>

      {/* ------------------------------------------------- enviados */}
      {enviados.length > 0 && (
        <section>
          <h2 className="text-[16px] font-extrabold">Enviados <span className="text-zinc-400">({enviados.length})</span></h2>
          <ul className="mt-3 space-y-1.5">
            {enviados.map((e) => {
              const r = e.respostaTipo ? RESPOSTA[e.respostaTipo] || RESPOSTA.outro : null;
              return (
                <li key={e.id} className={`rounded-xl px-3.5 py-2.5 text-[13px] ${r ? r.fundo : 'bg-zinc-50'}`}>
                  <div className="flex items-center gap-3">
                    {r ? <MessageSquareReply aria-hidden className="h-4 w-4 shrink-0" /> : <Check aria-hidden className="h-4 w-4 shrink-0 text-emerald-800" />}
                    <span className="min-w-0 flex-1 truncate">
                      <b>{e.nome}</b> · “{e.assunto}” · {e.para}
                    </span>
                    {r ? (
                      <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-0.5 text-[11.5px] font-extrabold">{r.rotulo}</span>
                    ) : (
                      e.enviadoEm && <span className="shrink-0 text-[12px] text-zinc-500">enviado {quando(e.enviadoEm)}</span>
                    )}
                  </div>
                  {r && (
                    <p className="mt-1 pl-7 text-[12.5px] leading-relaxed text-zinc-700">
                      {e.respostaResumo}
                      {e.respostaMessageId && (
                        <>
                          {' '}
                          <a
                            href={`https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(e.respostaMessageId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline underline-offset-2"
                          >
                            Abrir no Gmail e responder
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-zinc-500">
            A cada 15 minutos a ferramenta lê o Gmail: quem respondeu interessado ou com pergunta vai para <b>Negociando</b> no CRM, quem disse não vai para <b>Descartado</b>.
            Responder continua sendo com você, pelo Gmail.
          </p>
        </section>
      )}
    </div>
  );
}

function Rascunho({ email, aoMudar, aoTirar }: { email: EmailNaFila; aoMudar: (e: EmailNaFila) => void; aoTirar: (id: string) => void }) {
  const [assunto, setAssunto] = useState(email.assunto);
  const [corpo, setCorpo] = useState(email.corpo);
  const [demo, setDemo] = useState(email.demoUrl || '');
  const [preco, setPreco] = useState(email.preco ? String(email.preco) : '');
  const [moeda, setMoeda] = useState<Moeda>(email.moeda || moedaDoLead(email.fuso, email.cidade));
  const precoDigitado = preco.trim() !== '';
  const precoOk = !precoDigitado || lerValor(preco) !== null;
  // cada tecla no valor (ou troca de moeda) refaz a frase do preço no texto
  function mudarPreco(texto: string, m: Moeda) {
    setPreco(texto);
    setMoeda(m);
    const v = lerValor(texto);
    if (v !== null || !texto.trim()) setCorpo((c) => comPreco(c, v, m));
  }
  const demoOk = /^https:\/\/[^\s]+\.[^\s]+$/i.test(demo.trim());
  const marcaOk = corpo.includes('[DEMO]') || (demoOk && corpo.includes(demo.trim()));
  const [ocupado, setOcupado] = useState<null | 'aprovar' | 'regerar' | 'tirar'>(null);
  const [erro, setErro] = useState<string | null>(email.erro);
  const palavras = corpo.trim().split(/\s+/).filter(Boolean).length;

  async function acao(a: 'aprovar' | 'regerar') {
    setOcupado(a);
    setErro(null);
    // o link da demo vai junto nas duas ações: "escrever outro" não perde o que você colou
    const r = await chamar(`/api/email-frio/${email.id}`, 'POST', { acao: a, demo: demo.trim(), preco: preco.trim(), moeda, ...(a === 'aprovar' ? { assunto, corpo } : {}) });
    setOcupado(null);
    if (r.ok) aoMudar(r.email);
    else setErro(r.erro || 'Não deu certo.');
  }

  return (
    <article className="rounded-[22px] border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold">{email.nome}</p>
          <p className="truncate text-[12px] text-zinc-500">
            para {email.para}
            {email.cidade ? ` · ${email.cidade}` : ''}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Tirar ${email.nome} da fila`}
          disabled={!!ocupado}
          onClick={async () => {
            setOcupado('tirar');
            const r = await chamar(`/api/email-frio/${email.id}`, 'DELETE');
            setOcupado(null);
            if (r.ok) aoTirar(email.id);
            else setErro(r.erro);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-tinta"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <label className="mt-3 block">
        <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-zinc-500">Assunto</span>
        <input
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-xl bg-zinc-100 px-3.5 py-2 text-[14px] font-semibold outline-none focus:ring-2 focus:ring-tinta"
        />
      </label>
      <label className="mt-2.5 block">
        <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-zinc-500">Link da demo · obrigatório</span>
        <span className="mt-1 flex gap-1.5">
          <input
            type="url"
            value={demo}
            onChange={(e) => setDemo(e.target.value)}
            placeholder="https://… o site de demonstração que você fez para eles"
            className={`min-w-0 flex-1 rounded-xl px-3.5 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-tinta ${demoOk ? 'bg-menta/50' : 'bg-manteiga/70'}`}
          />
          {demoOk && (
            <a href={demo.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center rounded-xl border border-zinc-200 px-3 text-[12.5px] font-bold hover:border-zinc-400">
              Abrir
            </a>
          )}
        </span>
        <span className="mt-1 block text-[11.5px] text-zinc-500">No envio, o link entra no lugar de <b>[DEMO]</b> no texto.</span>
      </label>
      <div className="mt-2.5">
        <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-zinc-500">Valor do site</span>
        <span className="mt-1 flex gap-1.5">
          <select
            value={moeda}
            onChange={(e) => mudarPreco(preco, e.target.value as Moeda)}
            aria-label="Moeda"
            className="shrink-0 rounded-xl bg-zinc-100 px-2.5 py-2 text-[13.5px] font-bold outline-none focus:ring-2 focus:ring-tinta"
          >
            {MOEDAS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.rotulo}
              </option>
            ))}
          </select>
          <input
            inputMode="decimal"
            value={preco}
            onChange={(e) => mudarPreco(e.target.value, moeda)}
            placeholder="ex.: 900"
            aria-label="Valor do site"
            className={`min-w-0 flex-1 rounded-xl px-3.5 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-tinta ${!precoOk ? 'bg-rosa' : precoDigitado ? 'bg-menta/50' : 'bg-zinc-100'}`}
          />
        </span>
        <span className="mt-1 block text-[11.5px] text-zinc-500">
          {!precoOk
            ? 'Digite só o número, por exemplo 900 ou 1200.'
            : precoDigitado
              ? 'A frase com o valor entrou no texto, logo depois da demo. Pode editar a frase à vontade.'
              : 'Digite o valor e a frase com o preço entra sozinha no texto, depois da demo. Em branco, o e-mail sai sem preço.'}
        </span>
      </div>
      <label className="mt-2.5 block">
        <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-zinc-500">E-mail · {palavras} palavras</span>
        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={11}
          className="mt-1 w-full resize-y rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:ring-2 focus:ring-tinta"
        />
      </label>
      <p className="mt-1 text-[11.5px] text-zinc-500">Depois do “Best, Lucas” entram a sua assinatura, o endereço e o link para não receber mais.</p>
      {erro && (
        <p role="alert" className="mt-2 rounded-xl bg-rosa px-3 py-2 text-[12.5px] font-semibold text-red-950">
          {erro}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!ocupado || !demoOk || !marcaOk}
          title={!demoOk ? 'Cole o link da demo para aprovar' : !marcaOk ? 'Escreva [DEMO] no texto onde o link deve aparecer' : undefined}
          onClick={() => acao('aprovar')}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[13px] font-bold text-white hover:bg-tinta-70 disabled:opacity-40"
        >
          {ocupado === 'aprovar' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
          Aprovar
        </button>
        {(!demoOk || !marcaOk) && (
          <span className="self-center text-[12px] font-semibold text-amber-800">
            {!demoOk ? 'Cole o link da demo para aprovar.' : 'Escreva [DEMO] no texto, onde o link deve aparecer.'}
          </span>
        )}
        <button
          type="button"
          disabled={!!ocupado}
          onClick={() => acao('regerar')}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-[13px] font-bold hover:border-zinc-400 disabled:opacity-40"
        >
          {ocupado === 'regerar' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <RotateCcw aria-hidden className="h-4 w-4" />}
          Escrever outro
        </button>
      </div>
    </article>
  );
}
