'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, PencilLine, Plus, RotateCcw, Save, SendHorizontal, Trash2, X } from 'lucide-react';
import {
  CONFIG_PADRAO, MAX_PERGUNTAS, normalizarConfig, type ConfigRobo, type Emojis, type Exemplo, type Formalidade,
} from '@/lib/robo-config';
import { ROTULO_AGUARDANDO } from '@/lib/robo-tipos';

/**
 * A tela de treino. À esquerda, o formulário (salva com o botão de baixo,
 * que avisa quando há mudança não salva). À direita, o "Testar o robô": você
 * escreve como se fosse o cliente e vê o que ele responderia com o treino da
 * tela, mesmo antes de salvar. "Corrigir" numa resposta vira um exemplo que
 * ele passa a seguir (e salva na hora).
 */

const FORMALIDADES: { id: Formalidade; rotulo: string; exemplo: string }[] = [
  { id: 'descontraido', rotulo: 'Descontraído', exemplo: '"Opa, beleza? Show, me conta…"' },
  { id: 'equilibrado', rotulo: 'Equilibrado', exemplo: '"Oi! Tudo bem? Me conta…"' },
  { id: 'formal', rotulo: 'Mais formal', exemplo: '"Olá, tudo bem? Poderia me contar…"' },
];

const EMOJIS: { id: Emojis; rotulo: string }[] = [
  { id: 'nunca', rotulo: 'Nunca' },
  { id: 'pouco', rotulo: 'De vez em quando' },
  { id: 'avontade', rotulo: 'À vontade' },
];

const PERGUNTAS_COMUNS = [
  'Quanto tempo demora para ficar pronto?',
  'Tem mensalidade? O que ela inclui?',
  'O domínio e o site ficam no meu nome?',
  'Preciso mandar fotos e textos?',
  'E se eu quiser mudar alguma coisa depois?',
  'Vocês cuidam do Google (aparecer nas buscas)?',
  'Vocês têm algum trabalho para eu ver?',
  'Como funciona o pagamento?',
];

interface Fala {
  autor: 'eu' | 'cliente';
  texto: string;
  /** só nas falas do robô: o que ele faria além de responder */
  info?: { acao: string; precisa: string; motivo: string; bloqueada: boolean };
}

const campo = 'min-h-[44px] w-full rounded-full border border-zinc-300 bg-white px-4 text-[13.5px] outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
const caixa = 'w-full rounded-2xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100';
const rotulo = 'mb-1 block text-[13px] font-bold text-tinta';
const dica = 'mt-1 text-[11.5px] leading-snug text-zinc-600';

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-inset ring-zinc-200 md:p-6">
      <h2 className="text-[16px] font-extrabold tracking-[-0.01em]">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-[12.5px] text-zinc-600">{descricao}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Opcoes<T extends string>({ valor, opcoes, aoMudar, rotuloGrupo }: { valor: T; opcoes: { id: T; rotulo: string; exemplo?: string }[]; aoMudar: (v: T) => void; rotuloGrupo: string }) {
  return (
    <div role="radiogroup" aria-label={rotuloGrupo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => aoMudar(o.id)}
          className={`min-h-[40px] rounded-full px-4 text-left text-[12.5px] font-bold transition ${valor === o.id ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta hover:bg-zinc-200'}`}
        >
          {o.rotulo}
          {o.exemplo && <span className={`ml-1.5 font-medium ${valor === o.id ? 'text-white/70' : 'text-zinc-500'}`}>{o.exemplo}</span>}
        </button>
      ))}
    </div>
  );
}

function Chave({ ligado, aoMudar, texto, detalhe }: { ligado: boolean; aoMudar: (v: boolean) => void; texto: string; detalhe: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={() => aoMudar(!ligado)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? 'bg-roxo-800' : 'bg-zinc-300'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] ${ligado ? 'left-6' : 'left-1'}`} />
      </button>
      <span>
        <span className="block text-[13px] font-bold">{texto}</span>
        <span className="block text-[12px] text-zinc-600">{detalhe}</span>
      </span>
    </label>
  );
}

export default function TreinoRobo({
  inicial,
  empresa,
  oferta,
  escritaAprendida,
  catalogo,
  geminiLigado,
}: {
  inicial: ConfigRobo;
  empresa: string;
  oferta: string;
  escritaAprendida: string[];
  catalogo: string[];
  geminiLigado: boolean;
}) {
  const [cfg, setCfg] = useState<ConfigRobo>(inicial);
  const [salvo, setSalvo] = useState(JSON.stringify(inicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = JSON.stringify(cfg) !== salvo;

  const set = <K extends keyof ConfigRobo>(k: K, v: ConfigRobo[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const txt = (k: keyof ConfigRobo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);

  // sair com mudança não salva pede confirmação
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (mudou) e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [mudou]);

  async function salvar(proximo: ConfigRobo = cfg) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/robo/treino', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: proximo }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'Não consegui salvar.');
      // o servidor limpa o que não vale (pergunta sem resposta, por exemplo)
      setCfg(j.config);
      setSalvo(JSON.stringify(j.config));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const perguntaSemResposta = cfg.perguntas.some((p) => p.pergunta.trim() && !p.resposta.trim());

  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ------------------------------------------------------------ formulário */}
      <div className="flex min-w-0 flex-col gap-4 pb-24">
        <a
          href="#t-testar"
          className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full bg-roxo-800 px-4 text-[13px] font-bold text-white transition hover:bg-roxo-700 xl:hidden"
        >
          <Bot aria-hidden className="h-4 w-4" /> Ir para o teste do robô
        </a>
        <Secao titulo="Quem ele é" descricao="O robô escreve em primeira pessoa, como você. Se o cliente perguntar sério se é robô, ele não nega: diz que usa um assistente para responder mais rápido e que você acompanha tudo.">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            <div>
              <label className={rotulo} htmlFor="t-nome">Nome</label>
              <input id="t-nome" value={cfg.nome} onChange={txt('nome')} maxLength={40} className={campo} />
            </div>
            <div>
              <label className={rotulo} htmlFor="t-apres">Como se apresenta</label>
              <input id="t-apres" value={cfg.apresentacao} onChange={txt('apresentacao')} maxLength={120} className={campo} />
            </div>
          </div>
        </Secao>

        <Secao titulo="Jeito de escrever" descricao="O que mais faz parecer gente. Ele também espelha o cliente: se a pessoa escreve curto e sem emoji, ele faz igual.">
          <div>
            <p className={rotulo}>Tom</p>
            <Opcoes rotuloGrupo="Tom" valor={cfg.formalidade} opcoes={FORMALIDADES} aoMudar={(v) => set('formalidade', v)} />
          </div>
          <div>
            <p className={rotulo}>Emojis</p>
            <Opcoes rotuloGrupo="Emojis" valor={cfg.emojis} opcoes={EMOJIS} aoMudar={(v) => set('emojis', v)} />
          </div>
          <Chave ligado={cfg.baloes} aoMudar={(v) => set('baloes', v)} texto="Responder em balões curtos" detalhe="Manda 2 ou 3 mensagens pequenas com &quot;digitando…&quot; entre elas, em vez de um bloco só." />
          <Chave ligado={cfg.risada} aoMudar={(v) => set('risada', v)} texto="Pode rir (kkk, haha)" detalhe="Só quando o cliente brincar." />
          <div>
            <label className={rotulo} htmlFor="t-expr">Expressões que você usa</label>
            <input id="t-expr" value={cfg.expressoes} onChange={txt('expressoes')} maxLength={800} className={campo} placeholder='"show", "fechou", "tranquilo", "fica à vontade"…' />
          </div>
          <div>
            <label className={rotulo} htmlFor="t-escrita">Mensagens suas, para ele copiar o jeito</label>
            <textarea id="t-escrita" value={cfg.exemplosDeEscrita} onChange={txt('exemplosDeEscrita')} rows={4} maxLength={3000} className={caixa} placeholder="Cole aqui algumas mensagens que você manda para clientes no WhatsApp, do seu jeito." />
            <p className={dica}>
              {escritaAprendida.length
                ? `Ele também aprende sozinho com as ${escritaAprendida.length} últimas mensagens que você mandou pela ferramenta.`
                : 'Ele também vai aprender sozinho com as mensagens que você mandar pela ferramenta.'}
            </p>
          </div>
        </Secao>

        <Secao titulo="O que ele sabe" descricao="Tudo aqui ele pode usar. O que não estiver escrito ele não inventa: te chama.">
          <p className="rounded-2xl bg-chao px-3.5 py-2.5 text-[12.5px] text-zinc-800">
            Já vai junto: <b>{empresa}</b> ({oferta}, de Meu perfil) e o catálogo das suas propostas, <b>sem preço</b>: {catalogo.slice(0, 6).join(', ')} e mais {Math.max(0, catalogo.length - 6)}. Valor ele só fala o da proposta montada.
          </p>
          <div>
            <label className={rotulo} htmlFor="t-sobre">Sobre a empresa e sobre você</label>
            <textarea id="t-sobre" value={cfg.sobre} onChange={txt('sobre')} rows={4} maxLength={2000} className={caixa} placeholder="Quem é você, de onde é, desde quando faz isso, o que te diferencia." />
          </div>
          <div>
            <label className={rotulo} htmlFor="t-serv">Serviços, do seu jeito</label>
            <textarea id="t-serv" value={cfg.servicos} onChange={txt('servicos')} rows={5} maxLength={4000} className={caixa} placeholder="O que cada serviço inclui, como funciona o processo, o que o cliente precisa mandar…" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className={rotulo} htmlFor="t-prazo">Prazos</label>
              <textarea id="t-prazo" value={cfg.prazos} onChange={txt('prazos')} rows={3} maxLength={1500} className={caixa} placeholder="Quanto tempo leva cada tipo de trabalho, e do que depende." />
            </div>
            <div>
              <label className={rotulo} htmlFor="t-pag">Pagamento</label>
              <textarea id="t-pag" value={cfg.pagamento} onChange={txt('pagamento')} rows={3} maxLength={1000} className={caixa} placeholder="Pix, cartão, quantas vezes, entrada e o resto quando…" />
            </div>
          </div>
          <div>
            <label className={rotulo} htmlFor="t-port">Portfólio (um link por linha, com uma frase)</label>
            <textarea id="t-port" value={cfg.portfolio} onChange={txt('portfolio')} rows={3} maxLength={1500} className={caixa} placeholder={'Barbearia em Gurupi: https://...\nClínica: https://...'} />
            <p className={dica}>Fora a prévia e a proposta do lead, só estes links ele pode mandar.</p>
          </div>
          <div>
            <label className={rotulo} htmlFor="t-agenda">Quando você faz chamadas</label>
            <input id="t-agenda" value={cfg.agenda} onChange={txt('agenda')} maxLength={600} className={campo} placeholder="Seg a sex, das 9h às 12h e das 14h às 18h. Chamada de vídeo pelo Meet ou ligação." />
            <p className={dica}>Ele sugere horários daqui, mas quem confirma é sempre você.</p>
          </div>
        </Secao>

        <Secao titulo="Perguntas frequentes" descricao="A resposta certa para o que os clientes sempre perguntam. Pergunta sem resposta não é salva.">
          <div className="flex flex-wrap gap-2">
            {PERGUNTAS_COMUNS.filter((q) => !cfg.perguntas.some((p) => p.pergunta === q)).map((q) => (
              <button
                key={q}
                type="button"
                disabled={cfg.perguntas.length >= MAX_PERGUNTAS}
                onClick={() => set('perguntas', [...cfg.perguntas, { pergunta: q, resposta: '' }])}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-lavanda px-3 text-[12px] font-bold text-tinta transition hover:bg-roxo-100"
              >
                <Plus aria-hidden className="h-3.5 w-3.5" /> {q}
              </button>
            ))}
          </div>
          {cfg.perguntas.map((p, i) => (
            <div key={i} className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
              <div className="flex items-start gap-2">
                <input
                  aria-label={`Pergunta ${i + 1}`}
                  value={p.pergunta}
                  onChange={(e) => set('perguntas', cfg.perguntas.map((x, j) => (j === i ? { ...x, pergunta: e.target.value.slice(0, 300) } : x)))}
                  className={`${campo} font-bold`}
                  placeholder="Pergunta"
                />
                <button
                  type="button"
                  onClick={() => set('perguntas', cfg.perguntas.filter((_, j) => j !== i))}
                  aria-label="Tirar esta pergunta"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white hover:text-red-700"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <textarea
                aria-label={`Resposta ${i + 1}`}
                value={p.resposta}
                onChange={(e) => set('perguntas', cfg.perguntas.map((x, j) => (j === i ? { ...x, resposta: e.target.value.slice(0, 1200) } : x)))}
                rows={2}
                className={`${caixa} mt-2`}
                placeholder="A resposta certa, do seu jeito"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={cfg.perguntas.length >= MAX_PERGUNTAS}
            onClick={() => set('perguntas', [...cfg.perguntas, { pergunta: '', resposta: '' }])}
            className="inline-flex min-h-[40px] w-fit items-center gap-1.5 rounded-full border border-zinc-300 px-4 text-[12.5px] font-bold transition hover:border-zinc-500"
          >
            <Plus aria-hidden className="h-4 w-4" /> Outra pergunta
          </button>
        </Secao>

        <Secao titulo="Regras" descricao="O que ele nunca deve fazer e quando ele responde.">
          <div>
            <label className={rotulo} htmlFor="t-proib">Nunca falar ou prometer</label>
            <textarea id="t-proib" value={cfg.proibido} onChange={txt('proibido')} rows={3} maxLength={1500} className={caixa} placeholder="Ex.: não falar de concorrentes, não prometer primeira página do Google, não oferecer desconto…" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={rotulo} htmlFor="t-ini">Responde das</label>
              <select id="t-ini" value={cfg.horaInicio} onChange={(e) => set('horaInicio', Number(e.target.value))} className={`${campo} w-[110px]`}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <div>
              <label className={rotulo} htmlFor="t-fim">até as</label>
              <select id="t-fim" value={cfg.horaFim} onChange={(e) => set('horaFim', Number(e.target.value))} className={`${campo} w-[110px]`}>
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <p className={`${dica} mb-2.5`}>Horário de Brasília. O que chegar fora disso ele responde às 9h.</p>
          </div>
        </Secao>

        {cfg.exemplos.length > 0 && (
          <Secao titulo={`Correções (${cfg.exemplos.length})`} descricao="O que você corrigiu no teste. Ele segue o jeito do certo em situações parecidas.">
            {cfg.exemplos.map((e, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl bg-zinc-50 p-3 text-[12.5px] ring-1 ring-inset ring-zinc-200">
                <div className="min-w-0 flex-1">
                  <p><span className="font-bold">Cliente:</span> {e.cliente || '—'}</p>
                  {e.errado && <p className="mt-0.5 text-zinc-500 line-through">{e.errado}</p>}
                  <p className="mt-0.5"><span className="font-bold text-emerald-800">Certo:</span> {e.certo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('exemplos', cfg.exemplos.filter((_, j) => j !== i))}
                  aria-label="Apagar esta correção"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white hover:text-red-700"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Secao>
        )}

        {/* ------------------------------------------- barra de salvar (só aparece com mudança) */}
        {!(mudou || erro || salvando) ? (
          <p className="px-1 text-[12.5px] font-semibold text-zinc-600">Tudo salvo. O robô já usa este treino.</p>
        ) : (
        <div className="sticky bottom-24 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-tinta px-5 py-3 text-white shadow-[0_12px_30px_rgba(11,11,15,0.25)] md:bottom-4">
          <p className="text-[12.5px] font-semibold text-white/80">
            {erro ? <span className="text-red-300">{erro}</span> : mudou ? 'Alterações ainda não salvas.' : 'Tudo salvo. O robô já usa este treino.'}
            {perguntaSemResposta && !erro && <span className="block text-amber-200">Tem pergunta sem resposta: ela não será salva.</span>}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!mudou || salvando}
              onClick={() => setCfg(normalizarConfig(JSON.parse(salvo)))}
              className="min-h-[40px] rounded-full px-4 text-[12.5px] font-bold text-white/80 transition hover:text-white disabled:opacity-40"
            >
              Desfazer
            </button>
            <button
              type="button"
              disabled={!mudou || salvando}
              onClick={() => salvar()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-5 text-[13px] font-extrabold text-tinta transition hover:bg-roxo-100 disabled:opacity-50"
            >
              <Save aria-hidden className="h-4 w-4" />
              {salvando ? 'Salvando…' : 'Salvar treino'}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* ------------------------------------------------------------ testar */}
      <TestarRobo
        cfg={cfg}
        geminiLigado={geminiLigado}
        aoCorrigir={(ex) => {
          const proximo = { ...cfg, exemplos: [...cfg.exemplos, ex].slice(-40) };
          setCfg(proximo);
          salvar(proximo);
        }}
      />
    </div>
  );
}

function TestarRobo({ cfg, geminiLigado, aoCorrigir }: { cfg: ConfigRobo; geminiLigado: boolean; aoCorrigir: (e: Exemplo) => void }) {
  const [nome, setNome] = useState('Barbearia do Zé');
  const [ramo, setRamo] = useState('Barbearia');
  const [previa, setPrevia] = useState(false);
  const [proposta, setProposta] = useState(false);
  const primeira = useMemo(
    () => `Oi, tudo bem? Aqui é o ${cfg.nome || CONFIG_PADRAO.nome}, da Vertion Stack. Vi que a ${nome} ainda não tem site e montei uma ideia rápida. Posso te mostrar?`,
    [cfg.nome, nome],
  );
  const [falas, setFalas] = useState<Fala[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [correcao, setCorrecao] = useState('');
  const fim = useRef<HTMLDivElement>(null);

  const conversa: Fala[] = [{ autor: 'eu', texto: primeira }, ...falas];

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [falas.length, pensando]);

  async function mandar() {
    const t = texto.trim();
    if (!t || pensando) return;
    const proximas: Fala[] = [...falas, { autor: 'cliente', texto: t }];
    setFalas(proximas);
    setTexto('');
    setPensando(true);
    setErro(null);
    try {
      const r = await fetch('/api/robo/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: cfg,
          lead: { nome, ramo, previa, proposta },
          conversa: [{ autor: 'eu', texto: primeira }, ...proximas].map((f) => ({ autor: f.autor, texto: f.texto })),
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'O robô não respondeu.');
      const d = j.decisao as { acao: string; mensagens: string[]; precisa: string; motivo: string };
      const info = { acao: d.acao, precisa: d.precisa, motivo: d.motivo, bloqueada: Boolean(j.bloqueada) };
      const novas: Fala[] = d.mensagens.length
        ? d.mensagens.map((m, i) => ({ autor: 'eu' as const, texto: m, info: i === d.mensagens.length - 1 ? info : undefined }))
        : [{ autor: 'eu' as const, texto: '', info }];
      setFalas((f) => [...f, ...novas]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  /** a resposta inteira do robô (todos os balões seguidos) e o que o cliente tinha dito antes */
  function trechoDaResposta(i: number) {
    let ini = i;
    while (ini > 0 && falas[ini - 1].autor === 'eu') ini--;
    const resposta = falas.slice(ini, i + 1).map((f) => f.texto).filter(Boolean).join(' / ');
    const cliente = ini > 0 ? falas[ini - 1].texto : '';
    return { resposta, cliente };
  }

  return (
    <aside aria-labelledby="t-testar" className="min-w-0 xl:sticky xl:top-3 xl:self-start">
      <div className="flex max-h-none flex-col rounded-[24px] bg-lavanda p-4 xl:max-h-[calc(100vh-24px)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-roxo-800 text-white">
            <Bot aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="t-testar" className="text-[15px] font-extrabold">Testar o robô</h2>
            <p className="text-[11.5px] text-zinc-700">Você é o cliente. Nada vai para o WhatsApp.</p>
          </div>
          <button
            type="button"
            onClick={() => { setFalas([]); setErro(null); setCorrigindo(null); }}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold transition hover:bg-roxo-100"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Recomeçar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <input aria-label="Nome do cliente de teste" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 80))} className="min-h-[36px] rounded-full border border-zinc-300 bg-white px-3 text-[12.5px] outline-none focus:border-roxo-500" />
          <input aria-label="Ramo do cliente de teste" value={ramo} onChange={(e) => setRamo(e.target.value.slice(0, 60))} className="min-h-[36px] rounded-full border border-zinc-300 bg-white px-3 text-[12.5px] outline-none focus:border-roxo-500" />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-semibold">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={previa} onChange={(e) => setPrevia(e.target.checked)} className="h-4 w-4 accent-[#5b21b6]" /> Já tem prévia
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={proposta} onChange={(e) => setProposta(e.target.checked)} className="h-4 w-4 accent-[#5b21b6]" /> Já tem proposta
          </label>
        </div>

        <div className="mt-3 min-h-[260px] flex-1 overflow-y-auto rounded-[18px] bg-white p-3">
          <ol className="flex flex-col gap-2">
            {conversa.map((f, k) => {
              const i = k - 1; // índice em `falas` (a primeira mensagem é fixa)
              const eu = f.autor === 'eu';
              return (
                <li key={k} className={`flex flex-col ${eu ? 'items-end' : 'items-start'}`}>
                  {f.texto && (
                    <div className={`max-w-[88%] rounded-[16px] px-3 py-2 text-[13px] leading-relaxed ${eu ? (k === 0 ? 'bg-tinta text-white' : 'bg-roxo-800 text-white') : 'bg-zinc-100'}`}>
                      <p className="whitespace-pre-wrap break-words">{f.texto}</p>
                    </div>
                  )}
                  {f.info && (
                    <div className="mt-1 flex max-w-[88%] flex-col items-end gap-1">
                      {f.info.bloqueada && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">Não sairia: tinha link ou trecho proibido</span>
                      )}
                      {f.info.acao === 'chamar_dono' && (
                        <span className="rounded-[12px] bg-manteiga px-2.5 py-1 text-right text-[11px] font-bold text-amber-950">
                          Te chamaria: {ROTULO_AGUARDANDO[f.info.precisa] || 'Precisa de você'}{f.info.motivo ? ` · ${f.info.motivo}` : ''}
                        </span>
                      )}
                      {f.info.acao === 'encerrar' && <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold">Encerraria a conversa e desligaria</span>}
                      {f.info.acao === 'nada' && <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold">Não responderia (não precisa)</span>}
                      {corrigindo !== i && f.texto && (
                        <button
                          type="button"
                          onClick={() => { setCorrigindo(i); setCorrecao(trechoDaResposta(i).resposta.replace(/ \/ /g, '\n')); }}
                          className="inline-flex items-center gap-1 text-[11.5px] font-bold text-roxo-800 hover:underline"
                        >
                          <PencilLine aria-hidden className="h-3.5 w-3.5" /> Corrigir esta resposta
                        </button>
                      )}
                    </div>
                  )}
                  {corrigindo === i && (
                    <div className="mt-1.5 w-full rounded-[14px] bg-chao p-2.5">
                      <label htmlFor="t-correcao" className="text-[12px] font-bold">Como você responderia?</label>
                      <textarea id="t-correcao" value={correcao} onChange={(e) => setCorrecao(e.target.value.slice(0, 800))} rows={3} className={`${caixa} mt-1 text-[12.5px]`} />
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          disabled={!correcao.trim()}
                          onClick={() => {
                            const t = trechoDaResposta(i);
                            aoCorrigir({ cliente: t.cliente, errado: t.resposta, certo: correcao.trim() });
                            setFalas((fs) => {
                              let ini = i;
                              while (ini > 0 && fs[ini - 1].autor === 'eu') ini--;
                              return [...fs.slice(0, ini), { autor: 'eu', texto: correcao.trim() }, ...fs.slice(i + 1)];
                            });
                            setCorrigindo(null);
                          }}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-roxo-800 px-3 text-[12px] font-bold text-white transition hover:bg-roxo-700 disabled:opacity-50"
                        >
                          <Check aria-hidden className="h-3.5 w-3.5" /> Ensinar assim
                        </button>
                        <button type="button" onClick={() => setCorrigindo(null)} className="inline-flex min-h-[34px] items-center gap-1 rounded-full px-3 text-[12px] font-bold text-zinc-700 hover:bg-white">
                          <X aria-hidden className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {pensando && <li className="text-[12px] font-semibold text-zinc-500">digitando…</li>}
          </ol>
          <div ref={fim} />
        </div>

        {erro && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">{erro}</p>}
        {!geminiLigado && <p className="mt-2 text-[12px] font-semibold text-zinc-700">Para testar, falta a chave do Gemini (GEMINI_API_KEY) na Vercel.</p>}

        <form
          onSubmit={(e) => { e.preventDefault(); mandar(); }}
          className="mt-3 flex items-end gap-2"
        >
          <label htmlFor="t-cliente" className="sr-only">Mensagem do cliente</label>
          <textarea
            id="t-cliente"
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(); } }}
            rows={2}
            disabled={!geminiLigado}
            placeholder="Escreva como se fosse o cliente…"
            className={`${caixa} resize-none`}
          />
          <button
            type="submit"
            disabled={!texto.trim() || pensando || !geminiLigado}
            aria-label="Mandar como cliente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta text-white transition hover:bg-tinta-70 disabled:bg-zinc-300"
          >
            <SendHorizontal aria-hidden className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-zinc-600">O teste usa o treino da tela, mesmo antes de salvar.</p>
      </div>
    </aside>
  );
}
