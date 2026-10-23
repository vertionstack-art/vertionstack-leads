'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, Bot, Check, ChevronDown, Circle, CircleCheck, ClipboardPaste, Copy, Gauge, MessageCircle, Send, SendHorizontal, Sparkles, Trash2, X,
} from 'lucide-react';
import { aplicarModelo, linkComTexto, mensagemPronta, problemaCurto, type DadosMensagem, type Remetente } from '@/lib/mensagem';
import { FASES, MENSAGEM_AUTOMATICA, OBJECOES, faseDoPasso, passoPorId, saudacao, type Fase } from '@/lib/roteiro';
import type { MensagemConversa } from '@/lib/conversa';
import type { UsoIa } from '@/lib/ia';
import { lerRespostaColada, type Sugestao } from '@/lib/sugestao';
import { ROTULO_AGUARDANDO, type EstadoRobo } from '@/lib/robo-tipos';
import { ehAutomatica, segundosDepois } from '@/lib/automatica';

/**
 * A tela da conversa guiada. Três colunas no computador (roteiro, conversa,
 * objeções e medidor da IA) e três abas no celular.
 *
 * A IA tem dois modos. Com a chave do Claude na Vercel, a sugestão vem
 * direto. Sem ela, a tela monta o pedido, a pessoa cola no chat do claude.ai
 * (o plano dela) e cola a resposta de volta.
 *
 * Nada sai daqui sozinho: "Abrir no WhatsApp" abre o WhatsApp da pessoa com o
 * texto preenchido, e quem aperta enviar é ela. A resposta do cliente é
 * colada à mão.
 */

const COR: Record<Fase['cor'], string> = {
  ceu: 'bg-ceu',
  manteiga: 'bg-manteiga',
  lavanda: 'bg-lavanda',
  rosa: 'bg-rosa',
  menta: 'bg-menta',
  zinco: 'bg-zinc-100',
};

const SITUACAO: Record<Sugestao['situacao'], string> = {
  atendente: 'Falando com atendente',
  decisor: 'Falando com quem decide',
  interessado: 'Cliente interessado',
  objecao: 'Objeção',
  sem_resposta: 'Sem resposta',
  recusou: 'Recusou',
  fechou: 'Fechou',
  outro: 'Conversa em andamento',
};

const dolar = (v: number) => `US$ ${v.toFixed(v > 0 && v < 0.1 ? 3 : 2).replace('.', ',')}`;
const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Aba = 'roteiro' | 'conversa' | 'objecoes';

export default function ConversaGuiada({
  leadId,
  numero,
  dados,
  remetente,
  proposta,
  mensagensIniciais,
  passosIniciais,
  usoInicial,
  statusLead,
  whatsappLigado = false,
  roboInicial,
}: {
  leadId: string;
  numero: string | null;
  dados: DadosMensagem;
  remetente: Remetente;
  proposta: string | null;
  mensagensIniciais: MensagemConversa[];
  passosIniciais: string[];
  usoInicial: UsoIa;
  statusLead: string;
  /** o WhatsApp da Vertion está conectado pela Evolution: envia daqui e as respostas chegam sozinhas */
  whatsappLigado?: boolean;
  /** o robô de vendas nesta conversa (lib/robo) */
  roboInicial: EstadoRobo;
}) {
  const [robo, setRobo] = useState(roboInicial);
  const [aba, setAba] = useState<Aba>('conversa');
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [passos, setPassos] = useState<Set<string>>(new Set(passosIniciais));
  const [uso, setUso] = useState(usoInicial);
  const [texto, setTexto] = useState('');
  const [passoDoTexto, setPassoDoTexto] = useState<string | null>(null);
  const [resposta, setResposta] = useState('');
  const [pedido, setPedido] = useState('');
  const [sugestao, setSugestao] = useState<{ s: Sugestao; custo: number | null } | null>(null);
  // modo "seu plano do Claude": o pedido montado, se a cópia deu certo, e a resposta colada de volta
  const [pedidoPlano, setPedidoPlano] = useState<{ texto: string; copiado: boolean } | null>(null);
  const [respostaClaude, setRespostaClaude] = useState('');
  const [pensando, setPensando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set([faseAtual(passosIniciais)]));

  const base = `/api/conversa/${encodeURIComponent(leadId)}`;

  // com o WhatsApp conectado, as respostas do lead chegam sozinhas: a tela confere a cada 8 segundos
  useEffect(() => {
    if (!whatsappLigado) return;
    let parado = false;
    const conferir = async () => {
      if (document.hidden) return;
      try {
        const j = await fetch(base, { cache: 'no-store' }).then((x) => x.json());
        if (!parado && j.ok) {
          setMensagens((atual) => (j.mensagens.length !== atual.length ? j.mensagens : atual));
          setPassos(new Set(j.passos));
          if (j.robo) setRobo(j.robo);
        }
      } catch {
        // rede caiu: tenta de novo na próxima volta
      }
    };
    const relogio = setInterval(conferir, 8000);
    return () => {
      parado = true;
      clearInterval(relogio);
    };
  }, [whatsappLigado, base]);

  /** envia UMA mensagem pelo WhatsApp da Vertion: só acontece porque a pessoa clicou */
  async function enviarPeloZap() {
    const t = texto.trim();
    if (!t) return;
    setOcupado(true);
    setErro(null);
    try {
      const j = await chamar(`${base}/enviar`, { method: 'POST', body: JSON.stringify({ texto: t, passo: passoDoTexto }) });
      if (j.mensagem) setMensagens((m) => (m.some((x) => x.id === j.mensagem.id) ? m : [...m, j.mensagem]));
      setPassos(new Set(j.passos));
      setTexto('');
      setPassoDoTexto(null);
      setSugestao(null);
      setAviso('Enviada pelo WhatsApp da Vertion.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // "Gerar nova abordagem": as que já saíram (para a IA não repetir) e o último ângulo sorteado
  const [abordagens, setAbordagens] = useState<string[]>([]);
  const [anguloAnterior, setAnguloAnterior] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  // o painel da abordagem com IA: os dados do lead e a ideia que você escreve
  const [painelAbordagem, setPainelAbordagem] = useState(false);
  const [ideiaAbordagem, setIdeiaAbordagem] = useState('');

  async function novaAbordagem() {
    setGerando(true);
    setErro(null);
    try {
      const j = await chamar(`${base}/abordagem`, {
        method: 'POST',
        body: JSON.stringify({ anteriores: abordagens, anguloAnterior, pedido: ideiaAbordagem }),
      });
      setAbordagens((a) => [...a, j.mensagem].slice(-6));
      setAnguloAnterior(j.angulo);
      usarTexto(j.mensagem, 'primeira');
      setAviso(`Abordagem nova (${j.rotulo}). Revise antes de enviar; clique de novo para outra.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  /** troca os marcadores do roteiro pelos dados deste lead */
  const preencher = useMemo(() => {
    return (modelo: string) => {
      if (modelo === MENSAGEM_AUTOMATICA) return mensagemPronta(dados, remetente);
      const t = modelo
        .split('{saudacao}').join(saudacao())
        .split('{do_time}').join(remetente.empresa ? `, do time ${remetente.empresa}` : '')
        .split('{proposta}').join(proposta || '[link da proposta: monte a proposta no painel]')
        .split('{previa}').join(dados.previaUrl || '[link da prévia: gere em PRÉVIA no painel]');
      return aplicarModelo(t, dados, remetente);
    };
  }, [dados, remetente, proposta]);

  async function chamar(url: string, init: RequestInit) {
    const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    const j = await r.json().catch(() => ({ ok: false }));
    if (!j.ok) throw new Error(j.erro || 'Não deu certo. Tente de novo.');
    return j;
  }

  function usarTexto(t: string, passo: string | null) {
    setTexto(t);
    setPassoDoTexto(passo);
    setAba('conversa');
    setAviso(null);
    setErro(null);
    requestAnimationFrame(() => document.getElementById('minha-mensagem')?.focus());
  }

  async function registrar(autor: 'eu' | 'cliente', t: string, passo: string | null) {
    const j = await chamar(base, { method: 'POST', body: JSON.stringify({ acao: 'mensagem', autor, texto: t, passo }) });
    setMensagens((m) => [...m, j.mensagem]);
    setPassos(new Set(j.passos));
    return j.mensagem as MensagemConversa;
  }

  async function enviarMinha(abrir: boolean) {
    const t = texto.trim();
    if (!t) return;
    setOcupado(true);
    setErro(null);
    try {
      if (abrir && numero) {
        window.open(linkComTexto(numero, t), '_blank', 'noopener');
        // anota no histórico do lead e tira de "novo", como a ficha faz
        fetch(`/api/leads/${encodeURIComponent(leadId)}/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: t }),
        }).catch(() => {});
      }
      await registrar('eu', t, passoDoTexto);
      setTexto('');
      setPassoDoTexto(null);
      setSugestao(null);
      setAviso(abrir ? 'WhatsApp aberto. Aperte enviar por lá; a mensagem já ficou registrada aqui.' : 'Registrada.');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function registrarResposta(pedirSugestao: boolean) {
    const t = resposta.trim();
    setErro(null);
    setAviso(null);
    if (t) {
      setOcupado(true);
      try {
        await registrar('cliente', t, null);
        setResposta('');
      } catch (e) {
        setErro((e as Error).message);
        setOcupado(false);
        return;
      }
      setOcupado(false);
    }
    if (pedirSugestao) await (uso.ligada ? sugerir() : montarPedido());
  }

  /** modo "seu plano": monta o pedido e copia para colar no claude.ai */
  async function montarPedido() {
    setPensando(true);
    setErro(null);
    setSugestao(null);
    setRespostaClaude('');
    try {
      const j = await chamar(`${base}/pedido`, { method: 'POST', body: JSON.stringify({ pedido }) });
      let copiado = false;
      try {
        await navigator.clipboard.writeText(j.texto);
        copiado = true;
      } catch {
        // sem permissão de copiar: o pedido aparece num campo para copiar à mão
      }
      setPedidoPlano({ texto: j.texto, copiado });
      setPedido('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  function lerResposta() {
    const s = lerRespostaColada(respostaClaude);
    if (!s.mensagem) return setErro('Cole a resposta do Claude primeiro.');
    setSugestao({ s, custo: null });
    setPedidoPlano(null);
    setRespostaClaude('');
    if (s.passo) setAbertas((a) => new Set(a).add(faseDoPasso(s.passo)?.id || ''));
  }

  async function sugerir() {
    setPensando(true);
    setErro(null);
    setSugestao(null);
    try {
      const r = await fetch(`${base}/sugerir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (j.uso) setUso(j.uso);
      if (!j.ok) throw new Error(j.erro || 'A IA não respondeu. Tente de novo.');
      setSugestao({ s: j.sugestao, custo: j.custoUsd });
      setPedido('');
      if (j.sugestao.passo) setAbertas((a) => new Set(a).add(faseDoPasso(j.sugestao.passo)?.id || ''));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  async function alternarPasso(passo: string) {
    const feito = !passos.has(passo);
    setPassos((p) => {
      const x = new Set(p);
      if (feito) x.add(passo);
      else x.delete(passo);
      return x;
    });
    try {
      const j = await chamar(base, { method: 'POST', body: JSON.stringify({ acao: 'passo', passo, feito }) });
      setPassos(new Set(j.passos));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function apagar(id: number) {
    if (!confirm('Apagar esta mensagem do registro? (No WhatsApp ela continua.)')) return;
    try {
      await chamar(`${base}?mensagem=${id}`, { method: 'DELETE' });
      setMensagens((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const totalPassos = FASES.reduce((n, f) => n + f.passos.length, 0);

  const abaBotao = (a: Aba, rotulo: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === a}
      onClick={() => setAba(a)}
      className={`min-h-[40px] flex-1 rounded-full text-[13px] font-bold transition-colors ${aba === a ? 'bg-tinta text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="mt-6 flex-1">
      <div role="tablist" className="mb-4 flex gap-1 rounded-full bg-zinc-100 p-1 lg:hidden">
        {abaBotao('roteiro', `Roteiro ${passos.size}/${totalPassos}`)}
        {abaBotao('conversa', 'Conversa')}
        {abaBotao('objecoes', 'Objeções')}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* ------------------------------------------------------ roteiro */}
        <section aria-labelledby="t-roteiro" className={`${aba === 'roteiro' ? '' : 'hidden'} lg:block`}>
          <div className="flex items-baseline justify-between">
            <h2 id="t-roteiro" className="text-[16px] font-extrabold tracking-[-0.01em]">Roteiro</h2>
            <span className="text-[12px] font-bold tabular-nums text-zinc-500">{passos.size} de {totalPassos} passos</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-zinc-500">Toque numa mensagem para levar ao editor. O passo é marcado quando você registra o envio.</p>
          <ol className="mt-3 space-y-2.5">
            {FASES.map((f) => {
              const aberta = abertas.has(f.id);
              const feitos = f.passos.filter((p) => passos.has(p.id)).length;
              return (
                <li key={f.id} className={`rounded-[20px] ${COR[f.cor]} p-1`}>
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setAbertas((a) => { const x = new Set(a); if (x.has(f.id)) x.delete(f.id); else x.add(f.id); return x; })}
                    className="flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-extrabold">{f.titulo}</span>
                      <span className="block text-[11.5px] leading-snug text-zinc-700">{f.quando}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-zinc-700">{feitos}/{f.passos.length}</span>
                    <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                  </button>
                  {aberta && (
                    <ul className="space-y-1.5 px-1 pb-1">
                      {f.passos.map((p) => {
                        const feito = passos.has(p.id);
                        return (
                          <li key={p.id} className="rounded-[14px] bg-white p-3">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => alternarPasso(p.id)}
                                aria-pressed={feito}
                                title={feito ? 'Desmarcar' : 'Marcar como feito'}
                                className="mt-0.5 shrink-0 rounded-full text-zinc-400 hover:text-tinta"
                              >
                                {feito ? <CircleCheck aria-hidden className="h-[18px] w-[18px] text-emerald-600" /> : <Circle aria-hidden className="h-[18px] w-[18px]" />}
                                <span className="sr-only">{feito ? 'Feito' : 'Marcar como feito'}</span>
                              </button>
                              <div className="min-w-0">
                                <p className={`text-[13px] font-bold ${feito ? 'text-zinc-400 line-through' : ''}`}>{p.titulo}</p>
                                <p className="text-[11.5px] leading-snug text-zinc-500">{p.objetivo}</p>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                              {p.mensagens.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => usarTexto(preencher(m.texto), p.id)}
                                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-bold text-zinc-700 hover:bg-tinta hover:text-white"
                                >
                                  {m.rotulo}
                                </button>
                              ))}
                              {p.id === 'primeira' && (
                                <button
                                  type="button"
                                  aria-expanded={painelAbordagem}
                                  onClick={() => setPainelAbordagem((v) => !v)}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition ${
                                    painelAbordagem ? 'bg-roxo-100 text-roxo-800' : 'bg-roxo-800 text-white hover:bg-roxo-700'
                                  }`}
                                >
                                  <Sparkles aria-hidden className="h-3.5 w-3.5" />
                                  Abordagem com IA
                                </button>
                              )}
                            </div>
                            {p.id === 'primeira' && painelAbordagem && (
                              <div className="mt-2.5 rounded-[14px] bg-lavanda p-3 sm:ml-6">
                                <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-roxo-800">O que a IA sabe deste lead</p>
                                <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-zinc-800">
                                  <li><b>{dados.nome}</b>{[dados.category, dados.city].filter(Boolean).length ? ` · ${[dados.category, dados.city].filter(Boolean).join(' · ')}` : ''}</li>
                                  <li>Encontramos: {problemaCurto(dados)}</li>
                                  {dados.rating && dados.reviews ? <li>Google: {dados.rating.toFixed(1).replace('.', ',')} estrelas, {dados.reviews} avaliações</li> : null}
                                  <li>{dados.instagram ? 'Tem Instagram' : 'Sem Instagram cadastrado'} · {dados.previaUrl ? 'Prévia pronta' : 'Sem prévia ainda'}</li>
                                </ul>
                                <label htmlFor="ideia-abordagem" className="mt-2.5 block text-[12px] font-bold">Como quer abordar? (opcional)</label>
                                <textarea
                                  id="ideia-abordagem"
                                  value={ideiaAbordagem}
                                  onChange={(e) => setIdeiaAbordagem(e.target.value.slice(0, 500))}
                                  rows={3}
                                  placeholder="Ex.: vi que o site deles está em construção, quero oferecer terminar e deixar pronto para o Google"
                                  className="mt-1 w-full resize-y rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-[12.5px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
                                />
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={novaAbordagem}
                                    disabled={gerando}
                                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-roxo-800 px-3.5 text-[12px] font-bold text-white transition hover:bg-roxo-700 disabled:opacity-60"
                                  >
                                    <Sparkles aria-hidden className="h-3.5 w-3.5" />
                                    {gerando ? 'Gerando…' : abordagens.length ? 'Gerar outra' : 'Gerar abordagem'}
                                  </button>
                                  <span className="text-[11px] leading-snug text-zinc-600">
                                    {ideiaAbordagem.trim() ? 'A IA segue a sua ideia, no seu jeito de escrever.' : 'Em branco, a IA escolhe um jeito diferente a cada clique.'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* ------------------------------------------------------ conversa */}
        <section aria-labelledby="t-conversa" className={`${aba === 'conversa' ? '' : 'hidden'} min-w-0 lg:block`}>
          <h2 id="t-conversa" className="sr-only">Conversa</h2>

          {whatsappLigado && (
            <PainelRobo
              base={base}
              robo={robo}
              previa={dados.previaUrl || null}
              proposta={proposta}
              aoMudar={(j) => {
                setRobo(j.robo);
                setMensagens(j.mensagens);
                setPassos(new Set(j.passos));
              }}
            />
          )}

          <div className="rounded-[24px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
            {mensagens.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-zinc-500">
                Nada registrado ainda. Comece pelo roteiro: <b>Primeiro contato → Primeira mensagem</b>.
              </p>
            ) : (
              <ol className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1">
                {mensagens.map((m, i) => {
                  const eu = m.autor === 'eu';
                  const p = passoPorId(m.passo);
                  const nossaAnterior = eu ? null : [...mensagens.slice(0, i)].reverse().find((x) => x.autor === 'eu')?.em;
                  const automatica = !eu && ehAutomatica(m.texto, segundosDepois(m.em, nossaAnterior));
                  return (
                    <li key={m.id} className={`group flex ${eu ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[85%] rounded-[18px] px-3.5 py-2.5 ${m.robo ? 'bg-roxo-800 text-white' : eu ? 'bg-tinta text-white' : 'bg-white ring-1 ring-inset ring-zinc-200'}`}>
                        <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{m.texto}</p>
                        <p className={`mt-1 flex items-center gap-1 text-[10.5px] font-medium ${eu ? 'text-white/70' : 'text-zinc-500'}`}>
                          {m.robo && <Bot aria-hidden className="h-3 w-3" />}
                          {m.robo ? 'Robô' : eu ? 'Você' : automatica ? 'Cliente · resposta automática' : 'Cliente'} · {hora(m.em)}{p ? ` · ${p.titulo}` : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => apagar(m.id)}
                          title="Apagar do registro"
                          className={`absolute -top-2 ${eu ? '-left-2' : '-right-2'} hidden rounded-full bg-white p-1 text-zinc-500 shadow ring-1 ring-zinc-200 hover:text-red-700 group-hover:block focus:block`}
                        >
                          <Trash2 aria-hidden className="h-3 w-3" />
                          <span className="sr-only">Apagar do registro</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* o cliente respondeu */}
          <div className="mt-4 rounded-[24px] border border-zinc-200 p-4">
            <label htmlFor="resposta-cliente" className="text-[13px] font-extrabold">O cliente respondeu</label>
            <textarea
              id="resposta-cliente"
              value={resposta}
              onChange={(e) => setResposta(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="Cole aqui o que ele escreveu no WhatsApp"
              className="mt-2 w-full resize-y rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={pedido}
                onChange={(e) => setPedido(e.target.value.slice(0, 300))}
                placeholder="Pedido para a IA (opcional): mais curto, ele pediu preço…"
                className="min-h-[40px] min-w-0 basis-full rounded-full bg-zinc-100 px-3.5 text-[12.5px] sm:basis-0 sm:flex-1 outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-roxo-200"
              />
              <button
                type="button"
                disabled={pensando || ocupado}
                onClick={() => registrarResposta(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-roxo-600 px-4 text-[12.5px] font-bold text-white hover:bg-roxo-700 disabled:bg-zinc-300"
              >
                <Sparkles aria-hidden className="h-4 w-4" />
                {pensando
                  ? uso.ligada ? 'Pensando…' : 'Montando…'
                  : uso.ligada
                    ? resposta.trim() ? 'Registrar e sugerir resposta' : 'Sugerir próxima mensagem'
                    : resposta.trim() ? 'Registrar e montar pedido para o Claude' : 'Montar pedido para o Claude'}
              </button>
              <button
                type="button"
                disabled={ocupado || !resposta.trim()}
                onClick={() => registrarResposta(false)}
                className="min-h-[40px] rounded-full px-3 text-[12.5px] font-bold text-zinc-600 ring-1 ring-inset ring-zinc-300 hover:ring-tinta disabled:opacity-40"
              >
                Só registrar
              </button>
            </div>
          </div>

          {/* modo "seu plano": colar no claude.ai e trazer a resposta de volta */}
          {pedidoPlano && (
            <div className="mt-4 rounded-[24px] bg-lavanda p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-extrabold">
                  {pedidoPlano.copiado ? 'Pedido copiado. Agora é no Claude:' : 'Copie o pedido abaixo e leve ao Claude:'}
                </p>
                <button type="button" onClick={() => setPedidoPlano(null)} className="rounded-full p-1 hover:bg-white/60" title="Fechar">
                  <X aria-hidden className="h-4 w-4" />
                  <span className="sr-only">Fechar</span>
                </button>
              </div>
              {!pedidoPlano.copiado && (
                <textarea
                  readOnly
                  value={pedidoPlano.texto}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={4}
                  aria-label="Pedido para o Claude"
                  className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 font-mono text-[11.5px] leading-snug"
                />
              )}
              <ol className="mt-2 space-y-1.5 text-[13px] leading-snug">
                <li>
                  <b>1.</b>{' '}
                  <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold underline underline-offset-2">
                    Abra uma conversa nova no Claude <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li><b>2.</b> Cole o pedido (Ctrl+V) e envie.</li>
                <li><b>3.</b> Copie a resposta inteira do Claude e cole aqui:</li>
              </ol>
              <textarea
                value={respostaClaude}
                onChange={(e) => setRespostaClaude(e.target.value.slice(0, 8000))}
                rows={4}
                placeholder="Cole aqui a resposta do Claude"
                aria-label="Resposta do Claude"
                className="mt-2 w-full resize-y rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!respostaClaude.trim()}
                  onClick={lerResposta}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white hover:bg-tinta-70 disabled:bg-zinc-300"
                >
                  <ClipboardPaste aria-hidden className="h-4 w-4" /> Ler resposta
                </button>
                {pedidoPlano.copiado && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(pedidoPlano.texto); setAviso('Pedido copiado de novo.'); }}
                    className="min-h-[40px] rounded-full px-3 text-[12.5px] font-bold text-zinc-700 hover:text-tinta"
                  >
                    Copiar o pedido de novo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* sugestão da IA */}
          {pensando && uso.ligada && (
            <p className="mt-4 flex items-center gap-2 rounded-[20px] bg-lavanda px-4 py-3 text-[13px] font-semibold">
              <Bot aria-hidden className="h-4 w-4 animate-pulse" /> O Claude está lendo a conversa…
            </p>
          )}
          {sugestao && (
            <div className="mt-4 rounded-[24px] bg-lavanda p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold"><Bot aria-hidden className="h-3.5 w-3.5" /> Sugestão do Claude</span>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] font-bold">{SITUACAO[sugestao.s.situacao]}</span>
                {sugestao.s.passo && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] font-bold">Passo: {passoPorId(sugestao.s.passo)?.titulo}</span>}
                {sugestao.s.objecao && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11.5px] font-bold">Objeção: {OBJECOES.find((o) => o.id === sugestao.s.objecao)?.frase}</span>}
                <span className="ml-auto text-[11px] font-semibold tabular-nums text-zinc-600">
                  {sugestao.custo === null ? 'pelo seu plano do Claude' : `custou ${dolar(sugestao.custo)} ≈ ${reais(sugestao.custo * uso.dolar)}`}
                </span>
              </div>
              {sugestao.s.leitura && <p className="mt-2.5 text-[12.5px] leading-snug text-zinc-700"><b>Leitura:</b> {sugestao.s.leitura}</p>}
              {[sugestao.s.mensagem, sugestao.s.alternativa].filter(Boolean).map((t, i) => (
                <div key={i} className="mt-2.5 rounded-[16px] bg-white p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">{i === 0 ? 'Mensagem sugerida' : 'Outra opção'}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{t}</p>
                  <button
                    type="button"
                    onClick={() => usarTexto(t, sugestao.s.passo || null)}
                    className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-full bg-tinta px-3.5 text-[12px] font-bold text-white hover:bg-tinta-70"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" /> Usar esta
                  </button>
                </div>
              ))}
              {sugestao.s.proximo && <p className="mt-2.5 text-[12.5px] leading-snug text-zinc-700"><b>Depois de enviar:</b> {sugestao.s.proximo}</p>}
            </div>
          )}

          {/* minha mensagem */}
          <div className="mt-4 rounded-[24px] border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="minha-mensagem" className="text-[13px] font-extrabold">Sua próxima mensagem</label>
              {passoDoTexto && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-[11.5px] font-bold">
                  {passoPorId(passoDoTexto)?.titulo}
                  <button type="button" onClick={() => setPassoDoTexto(null)} className="rounded-full p-0.5 hover:bg-zinc-200" title="Não marcar passo">
                    <X aria-hidden className="h-3 w-3" />
                    <span className="sr-only">Não marcar passo</span>
                  </button>
                </span>
              )}
            </div>
            <textarea
              id="minha-mensagem"
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 2000))}
              rows={6}
              placeholder="Escolha uma mensagem do roteiro, uma resposta de objeção, ou use a sugestão da IA. Edite à vontade."
              className="mt-2 w-full resize-y rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
            />
            {/\[[^\]]+\]/.test(texto) && (
              <p className="mt-1.5 text-[12px] font-semibold text-amber-800">Troque o que está [entre colchetes] antes de enviar.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {whatsappLigado && (
                <button
                  type="button"
                  disabled={ocupado || !texto.trim() || !numero || /\[[^\]]+\]/.test(texto)}
                  onClick={enviarPeloZap}
                  title={numero ? 'Envia agora pelo WhatsApp da Vertion' : 'Este lead não tem WhatsApp'}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-700 px-5 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:bg-zinc-300"
                >
                  <SendHorizontal aria-hidden className="h-4 w-4" /> {ocupado ? 'Enviando…' : 'Enviar pelo WhatsApp'}
                </button>
              )}
              <button
                type="button"
                disabled={ocupado || !texto.trim() || !numero}
                onClick={() => enviarMinha(true)}
                title={numero ? '' : 'Este lead não tem WhatsApp'}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[13px] font-bold disabled:bg-zinc-300 ${
                  whatsappLigado ? 'text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:ring-tinta disabled:text-white' : 'bg-tinta text-white hover:bg-tinta-70'
                }`}
              >
                <MessageCircle aria-hidden className="h-4 w-4" /> Abrir no WhatsApp
              </button>
              <button
                type="button"
                disabled={ocupado || !texto.trim()}
                onClick={() => enviarMinha(false)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:ring-tinta disabled:opacity-40"
              >
                <Send aria-hidden className="h-3.5 w-3.5" /> Já enviei, só registrar
              </button>
              <button
                type="button"
                disabled={!texto.trim()}
                onClick={() => { navigator.clipboard.writeText(texto); setAviso('Copiado.'); }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold text-zinc-600 hover:text-tinta disabled:opacity-40"
              >
                <Copy aria-hidden className="h-3.5 w-3.5" /> Copiar
              </button>
            </div>
            {!numero && <p className="mt-2 text-[12px] text-zinc-500">Este lead não tem celular com WhatsApp: copie a mensagem e envie por onde achar o contato.</p>}
          </div>

          {erro && <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-800">{erro}</p>}
          {aviso && !erro && <p role="status" className="mt-3 text-[12.5px] font-semibold text-emerald-800">{aviso}</p>}
          {statusLead === 'novo' && mensagens.length === 0 && (
            <p className="mt-3 text-[12px] text-zinc-500">Ao abrir o WhatsApp, o lead passa para &quot;Contatado&quot; e entra no CRM.</p>
          )}
        </section>

        {/* ------------------------------------------- objeções e medidor */}
        <aside className={`${aba === 'objecoes' ? '' : 'hidden'} space-y-5 lg:block`}>
          <MedidorIa uso={uso} aoMudar={setUso} />
          <section aria-labelledby="t-objecoes">
            <h2 id="t-objecoes" className="text-[16px] font-extrabold tracking-[-0.01em]">Objeções</h2>
            <p className="mt-1 text-[12.5px] leading-snug text-zinc-500">O que o cliente costuma dizer e uma resposta pronta.</p>
            <ul className="mt-3 space-y-2">
              {OBJECOES.map((o) => (
                <li key={o.id}>
                  <details className="group rounded-[16px] bg-zinc-50 ring-1 ring-inset ring-zinc-200 open:bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-bold">
                      “{o.frase}”
                      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-3.5 pb-3">
                      <p className="text-[11.5px] leading-snug text-zinc-500">{o.dica}</p>
                      <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed">{preencher(o.resposta)}</p>
                      <button
                        type="button"
                        onClick={() => usarTexto(preencher(o.resposta), null)}
                        className="mt-2 inline-flex min-h-[32px] items-center gap-1 rounded-full bg-tinta px-3 text-[11.5px] font-bold text-white hover:bg-tinta-70"
                      >
                        <Check aria-hidden className="h-3.5 w-3.5" /> Usar
                      </button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** a fase em que a conversa está: a primeira que ainda tem passo por fazer */
function faseAtual(feitos: string[]): string {
  const f = FASES.find((x) => x.id !== 'sem_resposta' && x.passos.some((p) => !feitos.includes(p.id)));
  return (f || FASES[0]).id;
}

// ------------------------------------------------------------------ medidor

function Barra({ rotulo, gasto, limite, pedidos, dolarReais }: { rotulo: string; gasto: number; limite: number; pedidos: number; dolarReais: number }) {
  const pct = Math.min(100, limite > 0 ? (gasto / limite) * 100 : 0);
  const cor = pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-tinta';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-bold">{rotulo}</span>
        <span className="tabular-nums text-zinc-600">{Math.round(pct)}% usado</span>
      </div>
      <div
        role="meter"
        aria-label={`Uso da IA ${rotulo.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200"
      >
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11.5px] tabular-nums text-zinc-500">
        {dolar(gasto)} de {dolar(limite)} (≈ {reais(gasto * dolarReais)} de {reais(limite * dolarReais)}) · {pedidos} {pedidos === 1 ? 'pedido' : 'pedidos'}
      </p>
    </div>
  );
}

function MedidorIa({ uso, aoMudar }: { uso: UsoIa; aoMudar: (u: UsoIa) => void }) {
  const [editando, setEditando] = useState(false);
  const [dia, setDia] = useState(String(uso.limiteDiaUsd));
  const [mes, setMes] = useState(String(uso.limiteMesUsd));
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const r = await fetch('/api/ia/uso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diaUsd: Number(dia.replace(',', '.')), mesUsd: Number(mes.replace(',', '.')) }),
    });
    const j = await r.json().catch(() => ({ ok: false }));
    if (!j.ok) return setErro(j.erro || 'Não consegui salvar.');
    aoMudar(j.uso);
    setEditando(false);
  }

  return (
    <section aria-labelledby="t-medidor" className="rounded-[24px] bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200">
      <div className="flex items-center justify-between gap-2">
        <h2 id="t-medidor" className="flex items-center gap-1.5 text-[14px] font-extrabold"><Gauge aria-hidden className="h-4 w-4" /> Uso da IA</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${uso.ligada ? 'bg-menta text-emerald-950' : 'bg-lavanda text-tinta'}`}>
          {uso.ligada ? 'Automática' : 'Seu plano'}
        </span>
      </div>
      {!uso.ligada && (
        <div className="mt-2 space-y-2 text-[12px] leading-snug text-zinc-600">
          <p>
            A IA usa o seu plano do Claude: a ferramenta monta o pedido, você cola no Claude e traz a resposta de volta. Não tem custo além do plano.
          </p>
          <p>
            O limite de sessão e o semanal são os do seu plano e aparecem no próprio Claude, em{' '}
            <a href="https://claude.ai/settings/usage" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold text-tinta underline underline-offset-2">
              Configurações › Uso <ArrowUpRight aria-hidden className="h-3 w-3" />
            </a>
            . A Anthropic não deixa outro site ler esse limite.
          </p>
        </div>
      )}
      {uso.ligada && (
      <>
      <div className="mt-3 space-y-3">
        <Barra rotulo="Hoje" gasto={uso.hojeUsd} limite={uso.limiteDiaUsd} pedidos={uso.pedidosHoje} dolarReais={uso.dolar} />
        <Barra rotulo="Este mês" gasto={uso.mesUsd} limite={uso.limiteMesUsd} pedidos={uso.pedidosMes} dolarReais={uso.dolar} />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-zinc-500">
        Gasto real, contado a cada pedido ao {uso.modelo}. Em reais pela cotação de R$ {uso.dolar.toFixed(2).replace('.', ',')} (aproximada).
        Chegou no limite, a IA para até virar o dia ou o mês.
      </p>
      </>
      )}
      {!uso.ligada ? null : editando ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11.5px] font-bold">
              Por dia (US$)
              <input inputMode="decimal" value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 min-h-[36px] w-full rounded-full border border-zinc-300 bg-white px-3 text-[13px] font-medium outline-none focus:border-roxo-500" />
            </label>
            <label className="text-[11.5px] font-bold">
              Por mês (US$)
              <input inputMode="decimal" value={mes} onChange={(e) => setMes(e.target.value)} className="mt-1 min-h-[36px] w-full rounded-full border border-zinc-300 bg-white px-3 text-[13px] font-medium outline-none focus:border-roxo-500" />
            </label>
          </div>
          {erro && <p role="alert" className="text-[12px] font-semibold text-red-700">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={salvar} className="min-h-[36px] rounded-full bg-tinta px-4 text-[12px] font-bold text-white hover:bg-tinta-70">Salvar</button>
            <button type="button" onClick={() => setEditando(false)} className="text-[12px] font-bold text-zinc-500 hover:text-tinta">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="mt-2 text-[12px] font-bold text-zinc-600 underline-offset-2 hover:text-tinta hover:underline">
          Ajustar limites
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ robô */

interface RespostaRobo {
  robo: EstadoRobo;
  mensagens: MensagemConversa[];
  passos: string[];
}

/**
 * O robô de vendas nesta conversa: ligado ou pausado (e por quê), e, quando
 * ele está esperando você, o que ele precisa, com o "Entregar ao robô".
 */
function PainelRobo({
  base,
  robo,
  previa,
  proposta,
  aoMudar,
}: {
  base: string;
  robo: EstadoRobo;
  previa: string | null;
  proposta: string | null;
  aoMudar: (j: RespostaRobo) => void;
}) {
  const [entrega, setEntrega] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // o que ele espera já existe? vem preenchido
  useEffect(() => {
    if (robo.aguardando === 'previa' && previa) setEntrega((e) => e || previa);
    else if (robo.aguardando === 'proposta' && proposta) setEntrega((e) => e || proposta);
  }, [robo.aguardando, previa, proposta]);

  async function acao(nome: string, corpo: Record<string, unknown>) {
    setOcupado(nome);
    setErro(null);
    try {
      const r = await fetch(`${base}/robo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({ ok: false }));
      if (j.robo) aoMudar(j);
      if (!j.ok) throw new Error(j.erro || 'Não deu certo. Tente de novo.');
      if (nome === 'entregar') setEntrega('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const botao = 'inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition disabled:opacity-50';

  if (!robo.pronto || !robo.ativoNaConta) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[20px] bg-zinc-50 px-4 py-3 ring-1 ring-inset ring-zinc-200">
        <Bot aria-hidden className="h-5 w-5 shrink-0 text-zinc-500" />
        <p className="min-w-0 flex-1 text-[12.5px] font-semibold text-zinc-700">
          {!robo.pronto
            ? 'Robô de vendas: falta configurar a IA do robô na Vercel.'
            : 'Robô de vendas desligado na conta. Ligue na lista de Conversas para ele responder os leads.'}
        </p>
        {robo.pronto && (
          <a href="/conversas" className={`${botao} bg-white text-tinta ring-1 ring-inset ring-zinc-300 hover:ring-zinc-500`}>
            Ir para Conversas
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-4 rounded-[20px] p-4 ${robo.ligado ? 'bg-lavanda' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-200'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${robo.ligado ? 'bg-roxo-800 text-white' : 'bg-white text-zinc-500'}`}>
          <Bot aria-hidden className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold">
            {robo.ligado ? (robo.aguardando ? 'Robô esperando você' : 'Robô respondendo esta conversa') : 'Robô pausado nesta conversa'}
          </p>
          <p className="text-[12px] font-medium text-zinc-700">
            {robo.ligado
              ? `Responde quem responder, das 8h às 21h.${robo.respostasHoje ? ` ${robo.respostasHoje} ${robo.respostasHoje === 1 ? 'resposta' : 'respostas'} hoje.` : ''}`
              : robo.pausadoMotivo
                ? `Parou porque ${robo.pausadoMotivo}.`
                : 'Você conduz esta conversa.'}
          </p>
        </div>
        {robo.ligado && !robo.aguardando && (
          <button type="button" disabled={Boolean(ocupado)} onClick={() => acao('responder', { acao: 'responder' })} className={`${botao} bg-white text-tinta hover:bg-roxo-100`}>
            <SendHorizontal aria-hidden className="h-4 w-4" />
            {ocupado === 'responder' ? 'Respondendo…' : 'Responder agora'}
          </button>
        )}
        <button
          type="button"
          disabled={Boolean(ocupado)}
          aria-pressed={robo.ligado}
          onClick={() => acao('ligar', { acao: 'ligar', ligado: !robo.ligado })}
          className={`${botao} ${robo.ligado ? 'bg-white text-tinta ring-1 ring-inset ring-zinc-300 hover:ring-zinc-500' : 'bg-roxo-800 text-white hover:bg-roxo-700'}`}
        >
          {robo.ligado ? 'Pausar robô' : 'Ligar o robô aqui'}
        </button>
      </div>

      {robo.ligado && robo.aguardando && (
        <div className="mt-3 rounded-[16px] bg-white p-3.5">
          <p className="text-[12.5px] font-extrabold text-roxo-800">{ROTULO_AGUARDANDO[robo.aguardando]}</p>
          {robo.aguardandoMotivo && <p className="mt-0.5 text-[13px] leading-snug text-zinc-800">{robo.aguardandoMotivo}</p>}
          <label htmlFor="entrega-robo" className="mt-3 block text-[12.5px] font-bold">
            O que o robô deve mandar
          </label>
          <textarea
            id="entrega-robo"
            value={entrega}
            onChange={(e) => setEntrega(e.target.value.slice(0, 1500))}
            rows={3}
            placeholder={
              robo.aguardando === 'previa'
                ? 'Cole o link da prévia (gere no painel, botão PRÉVIA)'
                : robo.aguardando === 'proposta'
                  ? 'Cole o link da proposta (monte no painel ou em Propostas)'
                  : 'Escreva a resposta ou a decisão: "posso fazer 10% à vista", "terça às 15h confirmado"...'
            }
            className="mt-1.5 w-full resize-y rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100"
          />
          <p className="mt-1 text-[11.5px] text-zinc-600">O robô transforma isso numa mensagem natural e manda ao cliente.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(ocupado) || !entrega.trim()}
              onClick={() => acao('entregar', { acao: 'entregar', texto: entrega })}
              className={`${botao} bg-roxo-800 text-white hover:bg-roxo-700`}
            >
              <Send aria-hidden className="h-4 w-4" />
              {ocupado === 'entregar' ? 'Enviando…' : 'Entregar ao robô'}
            </button>
            <button type="button" disabled={Boolean(ocupado)} onClick={() => acao('resolver', { acao: 'resolver' })} className={`${botao} bg-zinc-100 text-tinta hover:bg-zinc-200`}>
              <Check aria-hidden className="h-4 w-4" />
              Resolvi eu mesmo
            </button>
          </div>
        </div>
      )}

      {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{erro}</p>}
    </div>
  );
}
