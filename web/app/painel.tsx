'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bell, Check, ChevronDown, Download, Upload, Flame, LayoutGrid, LogOut, MapPin,
  Crown, Kanban, MessageCircle, Radar, Wallet, Plus, RefreshCw, Search, ShieldCheck, Snowflake, Sun, Trash2, UserRound,
} from 'lucide-react';
import type { Lead, Status } from '@/lib/db';
import type { AvisoVencimento } from '@/lib/pagamento';
import { numeroWhatsapp } from '@/lib/telefone';
import SeloProposta from './selo-proposta';
import PromptModal, { type Variante } from './prompt-modal';
import { origemDoLead } from '@/lib/pais';
import { temperaturaDoLead, CLASSE_NIVEL, type Nivel } from '@/lib/temperatura';
import PropostaModal from './proposta-modal';
import CadastroModal from './cadastro-modal';
import LeadCard from './lead-card';
import type { WebsiteKind } from '@/lib/classify';
import { NOME_DO_PLANO, type Plano } from '@/lib/planos';
import Logo from './logo';
import FichaLead from './ficha-lead';
import PrimeirosPassos from './primeiros-passos';
import type { Passo } from '@/lib/passos';

// --------------------------------------------------------- constantes

/*
 * Os pastéis têm dono: rosa, manteiga e lavanda são só temperatura, menta é
 * só a fila. Presença digital e status ficam neutros e se distinguem por um
 * ponto colorido — senão "morno" e "só marketplace" saíam da mesma cor lado a
 * lado e ninguém sabia qual era qual.
 *
 * `barra` é a cor do pedaço na barra de oportunidades do resumo: do mais
 * urgente (sem nada, preto) ao que já tem site (branco, quase some). O mesmo
 * ponto aparece no selo da tabela.
 */
const NEUTRO = 'bg-zinc-100 text-tinta ring-transparent';
const TIPOS: { kind: WebsiteKind; rotulo: string; classe: string; barra: string }[] = [
  { kind: 'none', rotulo: 'Sem site', classe: NEUTRO, barra: 'bg-tinta' },
  { kind: 'social', rotulo: 'Só rede social', classe: NEUTRO, barra: 'bg-roxo-600' },
  { kind: 'marketplace', rotulo: 'Só marketplace', classe: NEUTRO, barra: 'bg-roxo-400' },
  { kind: 'weak', rotulo: 'Site fraco', classe: NEUTRO, barra: 'bg-roxo-200' },
  { kind: 'site', rotulo: 'Tem site', classe: 'bg-white text-zinc-600 ring-zinc-200', barra: 'bg-white ring-1 ring-zinc-300' },
];

const STATUS: { valor: Status; rotulo: string; classe: string; ponto: string }[] = [
  { valor: 'novo', rotulo: 'Novo', classe: 'bg-white text-tinta ring-zinc-300', ponto: 'bg-zinc-400' },
  { valor: 'contatado', rotulo: 'Contatado', classe: 'bg-white text-tinta ring-zinc-300', ponto: 'bg-sky-500' },
  { valor: 'negociando', rotulo: 'Negociando', classe: 'bg-white text-tinta ring-zinc-300', ponto: 'bg-roxo-600' },
  { valor: 'fechado', rotulo: 'Fechado', classe: 'bg-white text-tinta ring-zinc-300', ponto: 'bg-emerald-600' },
  { valor: 'descartado', rotulo: 'Descartado', classe: 'bg-white text-zinc-500 ring-zinc-300', ponto: 'bg-zinc-300' },
];

/** os três cartões de temperatura, cada um num campo pastel fixo */
const NIVEIS: { nivel: Nivel; rotulo: string; dica: string; fundo: string; Icone: typeof Flame }[] = [
  { nivel: 'quente', rotulo: 'Quentes', dica: 'ligar primeiro', fundo: 'bg-rosa', Icone: Flame },
  { nivel: 'morno', rotulo: 'Mornos', dica: 'vale tentar', fundo: 'bg-manteiga', Icone: Sun },
  { nivel: 'frio', rotulo: 'Frios', dica: 'por último', fundo: 'bg-lavanda', Icone: Snowflake },
];

const PAGINA = 100;



/** como cada resultado da verificação aparece na tabela */
const SITE_STATUS: Record<string, { rotulo: string; classe: string; bom: boolean }> = {
  ok:             { rotulo: 'no ar',        classe: 'text-zinc-500',                         bom: true },
  bloqueado:      { rotulo: 'não checado',  classe: 'text-zinc-500',                         bom: true },
  sem_https:      { rotulo: 'sem HTTPS',    classe: 'text-amber-800 font-semibold',          bom: false },
  em_construcao:  { rotulo: 'site vazio',   classe: 'text-emerald-800 font-semibold',        bom: false },
  nao_encontrado: { rotulo: 'site com erro',classe: 'text-emerald-800 font-semibold',        bom: false },
  fora_do_ar:     { rotulo: 'FORA DO AR',   classe: 'text-emerald-800 font-bold',            bom: false },
  virou_social:   { rotulo: 'vai p/ social',classe: 'text-emerald-800 font-semibold',        bom: false },
  certificado_vencido: { rotulo: 'certificado vencido', classe: 'text-emerald-800 font-semibold', bom: false },
};

// ------------------------------------------------------------- utils

/**
 * O link do WhatsApp do lead: o número que a empresa publicou num link (o
 * mais confiável) ou o celular do Maps. Telefone fixo não tem WhatsApp na
 * prática, então não ganha botão.
 */
function linkWhatsApp(lead: Pick<Lead, 'whatsapp' | 'phone' | 'telefoneTipo'>): string | null {
  const n = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));
  return n ? `https://wa.me/${n}` : null;
}

function tipoDe(kind: WebsiteKind) {
  return TIPOS.find((t) => t.kind === kind) || TIPOS[4];
}

/** primeira letra que não seja artigo nem símbolo — vira o "logo" do lead na tabela */
function inicial(nome: string): string {
  const palavra = nome.trim().split(/\s+/).find((p) => !/^(a|o|as|os|da|do|de|e|&)$/i.test(p)) || nome;
  return (palavra.match(/[\p{L}\p{N}]/u)?.[0] || '•').toUpperCase();
}

// ------------------------------------------------------------ pedaços

function Selo({ children, classe, ponto }: { children: React.ReactNode; classe: string; ponto?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset whitespace-nowrap ${classe}`}>
      {ponto && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ponto}`} />}
      {children}
    </span>
  );
}

/** botão da barra lateral preta: só o ícone, com o nome aparecendo ao passar o mouse */
/**
 * Item do trilho preto. Fechado, o trilho mostra só o ícone; com o mouse em
 * cima (ou o foco do teclado dentro dele) o trilho alarga e o nome aparece ao
 * lado. O nome está sempre no HTML, então leitor de tela lê mesmo fechado.
 */
function ItemTrilho({
  rotulo, ativo, onClick, href, children,
}: {
  rotulo: string; ativo?: boolean; onClick?: () => void; href?: string; children: React.ReactNode;
}) {
  const classe = `relative flex h-12 w-full shrink-0 items-center rounded-2xl transition-colors duration-200 ${
    ativo ? 'bg-white/12 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white'
  }`;
  const conteudo = (
    <>
      {ativo && <span className="absolute -left-4 h-6 w-[3px] rounded-r-full bg-white" />}
      <span className="flex h-12 w-12 shrink-0 items-center justify-center">{children}</span>
      <span className="-translate-x-1 whitespace-nowrap pr-3 text-[13.5px] font-semibold opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/trilho:translate-x-0 group-hover/trilho:opacity-100 group-focus-within/trilho:translate-x-0 group-focus-within/trilho:opacity-100 motion-reduce:transition-none">
        {rotulo}
      </span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={classe}>
        {conteudo}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classe}>
      {conteudo}
    </button>
  );
}

/** select com cara de pílula, igual aos filtros "24h ▾" da referência */
function Pilula({
  value, onChange, children, titulo, largura,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; titulo: string; largura?: string;
}) {
  return (
    <label className={`relative inline-flex shrink-0 ${largura || ''}`}>
      <span className="sr-only">{titulo}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={titulo}
        className="min-h-[40px] w-full cursor-pointer appearance-none truncate rounded-full border border-zinc-300 bg-white py-2 pl-4 pr-9 text-[13px] font-semibold text-tinta outline-none transition-colors hover:border-zinc-500 focus-visible:border-roxo-500"
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    </label>
  );
}

/** liga/desliga em forma de pílula — substitui as caixinhas de marcar */
function Alternador({
  ligado, onClick, children, titulo,
}: {
  ligado: boolean; onClick: () => void; children: React.ReactNode; titulo?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-pressed={ligado}
      className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 ${
        ligado ? 'bg-tinta text-white' : 'border border-zinc-300 bg-white text-tinta hover:border-zinc-500'
      }`}
    >
      {ligado && <Check aria-hidden className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/** botão de ação de cada lead na tabela: cinza enquanto falta, preto quando feito */
function Acao({
  onClick, titulo, feito, children,
}: {
  onClick: () => void; titulo: string; feito?: boolean; children: React.ReactNode;
}) {
  const cores = feito ? 'bg-tinta text-white hover:bg-tinta-70' : 'bg-white text-tinta ring-1 ring-inset ring-zinc-300 hover:ring-tinta';
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-pressed={feito}
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[10.5px] font-bold tracking-wide transition-colors duration-150 ${cores}`}
    >
      {feito && <Check aria-hidden className="h-3 w-3" />}
      {children}
    </button>
  );
}

/**
 * Quem clicou num plano na página de venda e criou a conta: o lembrete de que
 * escolheu aquele plano, com o botão direto. Fecha e não volta (por navegador).
 */
function AvisoPlanoEscolhido({ plano }: { plano: 'semanal' | 'basic' | 'pro' }) {
  const [fechado, setFechado] = useState(true);
  useEffect(() => {
    try {
      setFechado(localStorage.getItem('vl_aviso_plano') === plano);
    } catch {
      setFechado(false);
    }
  }, [plano]);
  if (fechado) return null;
  const nome = NOME_DO_PLANO[plano];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3.5 text-[13.5px] font-semibold ring-1 ring-inset ring-zinc-300">
      <span>
        Você escolheu o <b>{nome}</b> na página de venda. Teste à vontade; quando quiser, ele está a um clique.
      </span>
      <span className="flex items-center gap-2">
        <a href={`/planos?plano=${plano}`} className="inline-flex min-h-[38px] items-center rounded-full bg-tinta px-4 text-[13px] font-bold text-white hover:bg-tinta-70">
          Assinar o {nome}
        </a>
        <button
          type="button"
          onClick={() => {
            setFechado(true);
            try { localStorage.setItem('vl_aviso_plano', plano); } catch { /* sem armazenamento: só some agora */ }
          }}
          className="rounded-full px-3 py-2 text-[12.5px] font-bold text-zinc-500 hover:bg-zinc-100 hover:text-tinta"
        >
          Agora não
        </button>
      </span>
    </div>
  );
}

// ------------------------------------------------------------- tela

export interface CotaResumo {
  usados: number;
  limite: number;
  ilimitado: boolean;
  renovaEm: string;
  teste?: boolean;
  testeNegado?: string | null;
  /** leads de bônus por indicação, gastos depois da cota do plano */
  bonus?: number;
}

/**
 * O aviso do teste grátis: quanto falta, e depois o pedido para assinar. Os
 * leads, o CRM e as propostas continuam acessíveis; só a coleta para.
 */
function AvisoTeste({ usados, limite, negado, bonus = 0 }: { usados: number; limite: number; negado: string | null; bonus?: number }) {
  // com bônus de indicação a coleta continua, mesmo com o teste no fim
  const acabou = bonus <= 0 && (Boolean(negado) || usados >= limite);
  return (
    <div
      role={acabou ? 'alert' : undefined}
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 text-[13px] leading-relaxed ${
        acabou ? 'bg-tinta text-white' : 'bg-zinc-100 text-tinta'
      }`}
    >
      <span className="max-w-[640px]">
        {negado ? (
          <>
            <b className="text-[14.5px]">O teste grátis já foi usado em outra conta {negado}.</b>
            <br />
            Para coletar leads, assine um plano. Se isso é um engano, fale com o suporte.
          </>
        ) : acabou ? (
          <>
            <b className="text-[14.5px]">Seu teste grátis acabou.</b>
            <br />
            Você usou os {limite} leads do teste. Seus leads, o CRM e as propostas continuam aqui; para coletar novos,
            assine um plano.
          </>
        ) : (
          <>
            <b>Teste grátis:</b> {negado ? 'já usado em outra conta.' : <>{Math.min(usados, limite)} de {limite} leads usados. {limite - usados === 1 ? 'Resta 1.' : limite - usados > 1 ? `Restam ${limite - usados}.` : ''}</>}
            {bonus > 0 && <> Você tem mais <b className="tabular-nums">{bonus} leads de bônus</b> por indicação.</>}
          </>
        )}
      </span>
      <a
        href="/planos"
        className={`inline-flex min-h-[40px] shrink-0 items-center rounded-full px-5 text-[13px] font-bold transition-colors ${
          acabou ? 'bg-ceu text-tinta hover:bg-white' : 'bg-tinta text-white hover:bg-tinta-70'
        }`}
      >
        {acabou ? 'Assinar um plano' : 'Ver planos'}
      </a>
    </div>
  );
}

const NOME_PLANO_PAGO: Record<AvisoVencimento['plano'], string> = { semanal: '7 dias', basic: 'Basic', pro: 'Pro' };

/**
 * O aviso de vencimento do topo: o Pix e o plano de 7 dias não renovam
 * sozinhos, então avisa antes; e avisa cartão recusado, assinatura cancelada
 * perto do fim e plano que acabou de vencer.
 */
function AvisoDeVencimento({ aviso }: { aviso: AvisoVencimento }) {
  const nome = NOME_PLANO_PAGO[aviso.plano];
  const dia = new Date(aviso.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const quando = aviso.dias <= 0 ? '' : aviso.dias === 1 ? 'amanhã' : `em ${aviso.dias} dias`;
  const urgente = aviso.tipo === 'venceu' || aviso.tipo === 'cartao' || aviso.dias <= 1;
  const titulo =
    aviso.tipo === 'venceu'
      ? `Seu plano ${nome} venceu em ${dia}.`
      : aviso.tipo === 'cartao'
        ? 'O cartão foi recusado na renovação.'
        : aviso.tipo === 'cancelada'
          ? `Sua assinatura ${nome} termina ${quando} (${dia}).`
          : `Seu plano ${nome} vence ${quando} (${dia}).`;
  const texto =
    aviso.tipo === 'venceu'
      ? 'Seus leads, o CRM e as propostas continuam aqui. Renove para voltar a buscar leads novos.'
      : aviso.tipo === 'cartao'
        ? `Atualize o cartão antes de ${dia} para não perder o plano.`
        : aviso.tipo === 'cancelada'
          ? 'Depois disso a busca de leads novos para. Reative quando quiser.'
          : aviso.plano === 'semanal'
            ? 'O plano de 7 dias não renova sozinho. Para continuar, pague mais 7 dias ou assine um plano mensal.'
            : 'O pagamento por Pix não renova sozinho. Para não parar, pague mais um mês ou passe para o cartão.';
  return (
    <div
      role={urgente ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 text-[13px] leading-relaxed ${
        urgente ? 'bg-tinta text-white' : 'bg-manteiga text-amber-950 ring-1 ring-inset ring-amber-200'
      }`}
    >
      <span className="max-w-[640px]">
        <b className="text-[14.5px]">{titulo}</b>
        <br />
        {texto}
      </span>
      <a
        href="/planos"
        className={`inline-flex min-h-[40px] shrink-0 items-center rounded-full px-5 text-[13px] font-bold transition-colors ${
          urgente ? 'bg-ceu text-tinta hover:bg-white' : 'bg-tinta text-white hover:bg-tinta-70'
        }`}
      >
        {aviso.tipo === 'cartao' ? 'Atualizar cartão' : aviso.tipo === 'cancelada' ? 'Reativar' : 'Renovar'}
      </a>
    </div>
  );
}

export default function Painel({
  usuario,
  foto,
  plano,
  cota: cotaInicial,
  vencimento = null,
  passos = null,
  lembretesHoje = 0,
  planoEscolhido = null,
}: {
  /** o plano clicado na página de venda, enquanto a conta ainda está no teste */
  planoEscolhido?: 'semanal' | 'basic' | 'pro' | null;
  /** guia de primeiros passos; null quando já foi feito ou escondido */
  passos?: Passo[] | null;
  /** lembretes do CRM que vencem hoje ou já passaram */
  lembretesHoje?: number;
  /** aviso de plano vencendo ou vencido (lib/pagamento) */
  vencimento?: AvisoVencimento | null;
  usuario: string;
  foto?: string | null;
  plano: Plano;
  bloqueada?: boolean;
  cota: CotaResumo;
}) {
  // A central de administração de propósito não tem link aqui: quem usa
  // chega por endereço direto. A proteção continua sendo o servidor, que
  // só responde ao dono — esconder o botão não protegeria nada sozinho.
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cota, setCota] = useState<CotaResumo>(cotaInicial);
  const renovaTexto = new Date(cota.renovaEm).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState<Record<string, number>>({});
  const [cidades, setCidades] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [buscaDebounce, setBuscaDebounce] = useState('');
  const [kinds, setKinds] = useState<WebsiteKind[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<Status[]>([]);
  const [cidade, setCidade] = useState('');
  const [categoria, setCategoria] = useState('');
  const [comTelefone, setComTelefone] = useState(false);
  const [siteQuebrado, setSiteQuebrado] = useState(false);
  const [dePessoa, setDePessoa] = useState('');
  const [equipe, setEquipe] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<'recentes' | 'nome' | 'avaliacoes' | 'temperatura'>('recentes');
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [pagina, setPagina] = useState(0);

  const [verificando, setVerificando] = useState(false);
  const [progressoVerif, setProgressoVerif] = useState<{ feitos: number; faltam: number; achados: number } | null>(null);
  const [faltamVerif, setFaltamVerif] = useState(0);

  const [promptDe, setPromptDe] = useState<Lead | null>(null);
  const [variantePrompt, setVariantePrompt] = useState<Variante>('abordagem');
  const [propostaDe, setPropostaDe] = useState<Lead | null>(null);
  const [ficha, setFicha] = useState<{ id: string; aba: 'whatsapp' | 'lembrete' | 'historico' } | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [notaAberta, setNotaAberta] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);

  // a busca só dispara depois que você para de digitar
  useEffect(() => {
    const t = setTimeout(() => { setBuscaDebounce(busca); setPagina(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (buscaDebounce) p.set('q', buscaDebounce);
    if (kinds.length) p.set('kind', kinds.join(','));
    if (statusFiltro.length) p.set('status', statusFiltro.join(','));
    if (cidade) p.set('city', cidade);
    if (categoria) p.set('category', categoria);
    if (comTelefone) p.set('fone', '1');
    if (siteQuebrado) p.set('quebrado', '1');
    if (dePessoa) p.set('de', dePessoa);
    p.set('ordem', ordem);
    if (niveis.length) p.set('temp', niveis.join(','));
    p.set('limit', String(PAGINA));
    p.set('offset', String(pagina * PAGINA));
    return p.toString();
  }, [buscaDebounce, kinds, statusFiltro, cidade, categoria, comTelefone, siteQuebrado, dePessoa, ordem, niveis, pagina]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch('/api/leads?' + query, { cache: 'no-store' });
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'Falha ao carregar.');
      setLeads(d.leads);
      setTotal(d.total);
      setResumo(d.resumo);
      setCidades(d.cidades);
      setCategorias(d.categorias);
      if (d.equipe) setEquipe(d.equipe);
      if (d.cota) setCota(d.cota);
    } catch (e) {
      setErro(String((e as Error).message));
    } finally {
      setCarregando(false);
    }
  }, [query]);

  useEffect(() => { carregar(); }, [carregar]);

  // quantos leads têm site cadastrado que ninguém conferiu ainda
  const contarPendentes = useCallback(async () => {
    try {
      const r = await fetch('/api/leads/verificar', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setFaltamVerif(d.faltam);
    } catch { /* sem drama: o botão apenas não aparece */ }
  }, []);

  useEffect(() => { contarPendentes(); }, [contarPendentes]);

  /**
   * Chama a rota de verificação em rodadas até esvaziar a fila.
   * Cada rodada checa um punhado de sites; fazer tudo numa requisição só
   * estouraria o tempo limite da função na Vercel.
   */
  async function verificarSites() {
    setVerificando(true);
    setProgressoVerif({ feitos: 0, faltam: faltamVerif, achados: 0 });

    let feitos = 0;
    let achados = 0;

    try {
      for (let rodada = 0; rodada < 200; rodada++) {
        const r = await fetch('/api/leads/verificar', { method: 'POST' });
        const d = await r.json();
        if (!d.ok) throw new Error(d.erro || 'Falha ao verificar.');

        feitos += d.verificados;
        achados += d.novasOportunidades || 0;
        setProgressoVerif({ feitos, faltam: d.faltam, achados });
        setFaltamVerif(d.faltam);

        if (!d.verificados || !d.faltam) break;
      }
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message));
    } finally {
      setVerificando(false);
      setTimeout(() => setProgressoVerif(null), 8000);
    }
  }

  /*
   * Apagar é irreversível e não tem desfazer: o lead sai do banco e, se
   * veio do Maps, só volta com outra varredura — junto com a anotação, a
   * proposta e o link da prévia que estavam nele.
   */
  const [apagando, setApagando] = useState(false);
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [textoConfirma, setTextoConfirma] = useState('');

  async function apagarLote() {
    setApagando(true);
    try {
      const r = await fetch('/api/leads?' + query, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esperado: total }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErro(j.erro || 'Não consegui apagar.');
        return;
      }
      setConfirmandoLote(false);
      setTextoConfirma('');
      setPagina(0);
      await carregar();
    } catch {
      setErro('Falha de rede ao apagar.');
    } finally {
      setApagando(false);
    }
  }

  /** algum filtro está reduzindo a lista? muda o texto e o risco do botão de apagar */
  const temFiltro = Boolean(
    buscaDebounce || kinds.length || statusFiltro.length || cidade || categoria ||
    comTelefone || siteQuebrado || dePessoa || niveis.length,
  );

  function alternar<T>(lista: T[], set: (v: T[]) => void, valor: T) {
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
    setPagina(0);
  }

  async function salvarPatch(
    id: string,
    patch: { status?: Status; notes?: string | null; proposta?: unknown; previaUrl?: string | null; cnpj?: unknown; briefing?: unknown },
  ) {
    setLeads((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } as Lead : l)));
    const r = await fetch('/api/leads/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { setErro('Não consegui salvar a alteração.'); carregar(); }
  }

  async function apagar(id: string, nome: string) {
    /*
     * Avisa o que some junto. Apagar um lead que já tem proposta montada e
     * prévia publicada custa muito mais que apagar um nome vindo da
     * varredura, e "Apagar da lista?" não deixava essa diferença clara.
     */
    const lead = leads.find((l) => l.id === id);
    const extras = [
      lead?.proposta ? 'a proposta montada' : null,
      lead?.previaUrl ? 'o link da prévia' : null,
      lead?.notes ? 'a anotação' : null,
    ].filter(Boolean);

    const aviso = extras.length
      ? String.fromCharCode(10, 10) + 'Some junto: ' + extras.join(', ') + '. Não dá para desfazer.'
      : String.fromCharCode(10, 10) + 'Não dá para desfazer.';

    if (!confirm(`Apagar "${nome}" de vez?` + aviso)) return;
    await fetch('/api/leads/' + encodeURIComponent(id), { method: 'DELETE' });
    setLeads((atual) => atual.filter((l) => l.id !== id));
    setTotal((t) => t - 1);
  }

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1400);
  }

  // o servidor já conta as oportunidades pelo is_lead, que a verificação de
  // site também altera; a soma dos tipos ignoraria os sites que caíram
  const quentes = resumo.oportunidades ?? ((resumo.none || 0) + (resumo.social || 0) + (resumo.marketplace || 0) + (resumo.weak || 0));
  const ultimaPagina = (pagina + 1) * PAGINA >= total;

  const totalMapeado = resumo.total || 0;
  const somaNiveis = NIVEIS.reduce((s, n) => s + (resumo['temp_' + n.nivel] || 0), 0);
  const todasOportunidades = kinds.length === 4 && !kinds.includes('site');

  function limparFiltros() {
    setKinds([]); setStatusFiltro([]); setBusca(''); setCidade(''); setCategoria('');
    setComTelefone(false); setSiteQuebrado(false); setDePessoa(''); setNiveis([]); setPagina(0);
  }

  async function sair() {
    await fetch('/api/auth', { method: 'DELETE' });
    location.href = '/login';
  }

  /*
   * O cartão preto: o que fazer antes de ligar, fora da lista. Antes era a
   * fila do disparador (CONTACT), que saiu junto com o programa de disparo.
   * No celular ele desce para depois dos leads.
   */
  const cartaoAcao = (extra: string) => (
  <aside className={`relative isolate min-h-[200px] flex-col overflow-hidden rounded-[24px] bg-tinta p-5 text-white ${extra}`}>
    <svg aria-hidden viewBox="0 0 160 120" className="absolute -right-20 -top-14 -z-10 h-[150px] w-[200px] text-white/15" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="40" y="20" width="110" height="80" rx="14" transform="rotate(-12 95 60)" />
      <rect x="20" y="34" width="110" height="80" rx="14" transform="rotate(-4 75 74)" />
    </svg>
    <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
      Confira os{' '}
      <span className="inline-block -rotate-2 rounded-full border border-white/70 px-2.5 py-0.5 text-[18px]">sites</span>
    </h2>
    <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-white/70">
      {faltamVerif > 0 || verificando
        ? `${faltamVerif} ${faltamVerif === 1 ? 'site cadastrado ainda não foi conferido' : 'sites cadastrados ainda não foram conferidos'}. Site fora do ar vira lead quente.`
        : 'Todos os sites cadastrados já foram conferidos.'}
    </p>
    <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
      {(faltamVerif > 0 || verificando) && (
        <button
          onClick={verificarSites}
          disabled={verificando}
          title="Abre cada site cadastrado para ver se está mesmo no ar"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-ceu px-4 text-[13px] font-bold text-tinta transition-colors hover:bg-white disabled:opacity-60"
        >
          <ShieldCheck aria-hidden className="h-4 w-4" />
          {verificando ? 'Conferindo…' : `Conferir ${faltamVerif} sites`}
        </button>
      )}
      <a
        href="/buscar"
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/30 px-3.5 text-[13px] font-bold text-white transition-colors hover:border-white"
      >
        <Radar aria-hidden className="h-4 w-4" />
        Buscar leads
      </a>
    </div>
  </aside>
  );

  return (
    <div className="min-h-screen md:pl-[104px]">
      {/* ------------------------------------------- trilho preto (desktop) */}
      <nav
        aria-label="Menu"
        className="group/trilho fixed inset-y-3 left-3 z-40 hidden w-[80px] flex-col overflow-hidden rounded-[26px] bg-tinta px-4 py-5 transition-[width,box-shadow] duration-200 ease-out hover:w-[224px] hover:shadow-[0_18px_50px_rgba(11,11,15,0.28)] focus-within:w-[224px] motion-reduce:transition-none md:flex"
      >
        <div className="mb-8 flex items-center">
          <Logo tamanho={48} emQuadro />
          <span className="ml-3 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.01em] text-white opacity-0 transition-opacity duration-200 group-hover/trilho:opacity-100 group-focus-within/trilho:opacity-100">
            Vertion Leads
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <ItemTrilho rotulo="Painel" ativo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <LayoutGrid className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Buscar leads" href="/buscar">
            <Radar className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="CRM" href="/crm">
            <Kanban className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Financeiro" href="/financeiro">
            <Wallet className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Cadastrar comércio" onClick={() => setCadastrando(true)}>
            <Plus className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Planos" href="/planos">
            <Crown className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Importar planilha" href="/importar">
            <Upload className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Baixar CSV" href={'/api/leads/export?' + query}>
            <Download className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo={carregando ? 'Atualizando…' : 'Atualizar'} onClick={carregar}>
            <RefreshCw className={`h-5 w-5 ${carregando ? 'animate-spin' : ''}`} strokeWidth={1.8} />
          </ItemTrilho>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <ItemTrilho rotulo="Meu perfil" href="/perfil">
            <UserRound className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
          <ItemTrilho rotulo="Sair" onClick={sair}>
            <LogOut className="h-5 w-5" strokeWidth={1.8} />
          </ItemTrilho>
        </div>
      </nav>

      {/* ------------------------------------------- doca preta (celular) */}
      <nav
        aria-label="Menu"
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[22px] bg-tinta px-2 py-1.5 shadow-[0_10px_30px_rgba(11,11,15,0.25)] md:hidden"
      >
        {[
          { rotulo: 'Painel', Icone: LayoutGrid, acao: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
          { rotulo: 'Buscar', Icone: Radar, acao: () => (location.href = '/buscar') },
        ].map(({ rotulo, Icone, acao }) => (
          <button key={rotulo} onClick={acao} className="flex min-h-[52px] min-w-[64px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-white/70 active:text-white">
            <Icone className="h-5 w-5" strokeWidth={1.8} />
            {rotulo}
          </button>
        ))}
        <a href="/crm" className="flex min-h-[52px] min-w-[64px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-white/70 active:text-white">
          <Kanban className="h-5 w-5" strokeWidth={1.8} />
          CRM
        </a>
        <a href="/financeiro" className="flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-white/70 active:text-white">
          <Wallet className="h-5 w-5" strokeWidth={1.8} />
          Financeiro
        </a>
        <a href="/perfil" className="flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-white/70 active:text-white">
          <UserRound className="h-5 w-5" strokeWidth={1.8} />
          Perfil
        </a>
      </nav>

      {/* ------------------------------------------------- folha branca */}
      <div className="px-3 pb-28 pt-3 md:py-3 md:pl-0 md:pr-3">
        <div className="min-h-[calc(100vh-24px)] overflow-x-clip rounded-[var(--radius-folha)] bg-white px-5 pb-8 pt-6 md:px-9 md:pt-8">
          {/* ------------------------------------------------- topo */}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Visão geral</h1>
              <p className="mt-1.5 text-[13px] font-medium text-zinc-500">Comércios do Maps que ainda não têm site próprio</p>
            </div>

            <div className="flex w-full items-center gap-2.5 sm:w-auto">
              <label className="relative flex-1 sm:w-[300px] sm:flex-none">
                <span className="sr-only">Buscar lead</span>
                <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, telefone, endereço…"
                  className="min-h-[44px] w-full rounded-full bg-zinc-100 pl-10 pr-4 text-[13.5px] font-medium outline-none transition-colors placeholder:text-zinc-600 focus:bg-white focus:ring-2 focus:ring-roxo-200"
                />
              </label>
              <details className="group relative">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 transition-colors hover:bg-zinc-200 [&::-webkit-details-marker]:hidden">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-roxo-200 text-[14px] font-extrabold uppercase text-tinta">
                      {usuario.slice(0, 1)}
                    </span>
                  )}
                  <span className="hidden text-[13px] font-bold capitalize sm:inline">{usuario}</span>
                  <ChevronDown aria-hidden className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 rounded-2xl bg-white p-1.5 shadow-[0_12px_32px_rgba(11,11,15,0.14)] ring-1 ring-zinc-200">
                  <a href={'/api/leads/export?' + query} className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Download aria-hidden className="h-4 w-4 text-zinc-500" /> Baixar CSV
                  </a>
                  <a href="/perfil" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <UserRound aria-hidden className="h-4 w-4 text-zinc-500" /> Meu perfil
                  </a>
                  <a href="/crm" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Kanban aria-hidden className="h-4 w-4 text-zinc-500" /> CRM
                  </a>
                  <a href="/planos" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Crown aria-hidden className="h-4 w-4 text-zinc-500" /> Planos
                  </a>
                  <a href="/financeiro" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Wallet aria-hidden className="h-4 w-4 text-zinc-500" /> Financeiro
                  </a>
                  <a href="/buscar" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Radar aria-hidden className="h-4 w-4 text-zinc-500" /> Buscar leads
                  </a>
                  <a href="/importar" className="flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-[13px] font-semibold hover:bg-zinc-100">
                    <Upload aria-hidden className="h-4 w-4 text-zinc-500" /> Importar planilha
                  </a>
                  <button onClick={sair} className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-semibold hover:bg-zinc-100">
                    <LogOut aria-hidden className="h-4 w-4 text-zinc-500" /> Sair
                  </button>
                </div>
              </details>
            </div>
          </header>

          {passos && <PrimeirosPassos passos={passos} />}

          {/* ------------------------------------------------- avisos */}
          <div className="mt-6 space-y-3 empty:hidden">
            {vencimento && <AvisoDeVencimento aviso={vencimento} />}
            {planoEscolhido && <AvisoPlanoEscolhido plano={planoEscolhido} />}
            {lembretesHoje > 0 && (
              <a
                href="/crm#para-hoje"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-3.5 text-[13.5px] font-semibold ring-2 ring-inset ring-tinta transition-colors hover:bg-zinc-50"
              >
                <span className="flex items-center gap-2">
                  <Bell aria-hidden className="h-4 w-4" />
                  {lembretesHoje === 1 ? 'Você tem 1 lembrete para hoje.' : `Você tem ${lembretesHoje} lembretes para hoje.`}
                </span>
                <span className="font-bold underline underline-offset-2">Ver no CRM</span>
              </a>
            )}
            {!cota.ilimitado && cota.teste && vencimento?.tipo !== 'venceu' && (
              <AvisoTeste usados={cota.usados} limite={cota.limite} negado={cota.testeNegado ?? null} bonus={cota.bonus ?? 0} />
            )}
            {!cota.ilimitado && !cota.teste && (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-[13px] leading-relaxed ${
                  cota.usados >= cota.limite ? 'bg-zinc-100 text-tinta ring-2 ring-inset ring-tinta' : 'bg-zinc-100 text-tinta'
                }`}
              >
                <span>
                  {cota.usados >= cota.limite ? (
                    <>
                      <b>Você usou os {cota.limite} leads novos desta semana do plano {NOME_DO_PLANO[plano]}.</b> A cota volta{' '}
                      {renovaTexto}.{(cota.bonus ?? 0) > 0 ? <> Até lá, a coleta usa os seus <b className="tabular-nums">{cota.bonus} leads de bônus</b>.</> : ' Para coletar mais, veja os planos.'}
                    </>
                  ) : (
                    <>
                      <b>Plano {NOME_DO_PLANO[plano]}:</b> {cota.usados} de {cota.limite} leads novos usados nesta semana. Renova{' '}
                      {renovaTexto}.{(cota.bonus ?? 0) > 0 && <> E mais <b className="tabular-nums">{cota.bonus} de bônus</b> por indicação.</>}
                    </>
                  )}
                </span>
                <a
                  href="/planos"
                  className="inline-flex min-h-[38px] shrink-0 items-center rounded-full bg-tinta px-4 text-[12.5px] font-bold text-white transition-colors hover:bg-tinta-70"
                >
                  Ver planos
                </a>
              </div>
            )}
            {erro && (
              <div role="alert" className="rounded-2xl bg-rosa px-5 py-3.5 text-[13px] font-medium text-red-950">{erro}</div>
            )}
            {progressoVerif && (
              <div role="status" className="rounded-2xl bg-menta px-5 py-3.5 text-[13px] leading-relaxed text-emerald-950">
                {verificando ? (
                  <>
                    Conferindo os sites: <b>{progressoVerif.feitos}</b> checados
                    {progressoVerif.faltam > 0 && `, ${progressoVerif.faltam} na fila`}.
                    {progressoVerif.achados > 0 && (
                      <> Já achei <b>{progressoVerif.achados}</b> que não estão de pé.</>
                    )}
                  </>
                ) : (
                  <>
                    Conferi <b>{progressoVerif.feitos}</b> sites.{' '}
                    {progressoVerif.achados > 0 ? (
                      <>
                        <b>{progressoVerif.achados}</b> não estavam no ar e viraram oportunidade — eles
                        aparecem como <em>site fora do ar</em>, <em>site vazio</em> ou{' '}
                        <em>vai p/ social</em> na coluna de presença digital.
                      </>
                    ) : (
                      'Todos estavam no ar.'
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ---------------------------------- resumo: oportunidades + temperatura */}
          <section className="mt-8 grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="mb-4 text-[19px] font-extrabold tracking-[-0.02em]">Oportunidades</h2>
              <div className="flex min-h-[200px] flex-col rounded-[24px] bg-ceu p-6 lg:h-[236px]">
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => {
                      setKinds(todasOportunidades ? [] : ['none', 'social', 'marketplace', 'weak']);
                      setSiteQuebrado(false); setPagina(0);
                    }}
                    aria-pressed={todasOportunidades}
                    title="Mostrar só quem ainda não tem site próprio"
                    className="text-left"
                  >
                    <span className="block text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                      {quentes.toLocaleString('pt-BR')}
                    </span>
                    <span className="mt-2 block text-[13px] font-semibold text-sky-950/70">
                      sem site próprio, de {totalMapeado.toLocaleString('pt-BR')} mapeados
                    </span>
                  </button>
                  <button
                    onClick={limparFiltros}
                    disabled={!temFiltro && !niveis.length}
                    className="min-h-[36px] shrink-0 rounded-full bg-white px-4 text-[12px] font-bold text-tinta shadow-[0_2px_8px_rgba(11,11,15,0.08)] transition-opacity disabled:opacity-0"
                  >
                    Limpar filtros
                  </button>
                </div>

                {/* a barra divide a base inteira por presença digital: o preto é quem não tem nada */}
                <div className="mt-6 lg:mt-auto">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/70" aria-hidden>
                    {totalMapeado > 0 &&
                      TIPOS.map((t) => {
                        const n = resumo[t.kind] || 0;
                        if (!n) return null;
                        return <span key={t.kind} className={`${t.barra} h-full`} style={{ width: `${(n / totalMapeado) * 100}%` }} />;
                      })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {TIPOS.map((t) => {
                      const ativo = kinds.includes(t.kind);
                      return (
                        <button
                          key={t.kind}
                          onClick={() => alternar(kinds, setKinds, t.kind)}
                          aria-pressed={ativo}
                          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors duration-150 ${
                            ativo ? 'bg-tinta text-white' : 'bg-white/60 text-sky-950 hover:bg-white'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${t.barra} ${t.kind === 'site' ? 'ring-1 ring-zinc-300' : ''} ${ativo && t.kind === 'none' ? 'ring-1 ring-white' : ''}`} />
                          {t.rotulo}
                          <span className="tabular-nums opacity-60">{resumo[t.kind] || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-[19px] font-extrabold tracking-[-0.02em]">Temperatura</h2>
              <div className="grid grid-cols-3 gap-3">
                {NIVEIS.map(({ nivel, rotulo, dica, fundo, Icone }) => {
                  const n = resumo['temp_' + nivel] || 0;
                  const ativo = niveis.includes(nivel);
                  const parte = somaNiveis ? Math.round((n / somaNiveis) * 100) : 0;
                  return (
                    <button
                      key={nivel}
                      onClick={() => alternar(niveis, setNiveis, nivel)}
                      aria-pressed={ativo}
                      title={`Mostrar só os leads ${rotulo.toLowerCase()}`}
                      className={`flex min-h-[176px] flex-col rounded-[24px] p-4 text-left lg:h-[236px] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 sm:p-5 ${fundo} ${
                        ativo ? 'ring-2 ring-tinta ring-offset-2' : ''
                      }`}
                    >
                      <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-[44px]">
                        {n.toLocaleString('pt-BR')}
                      </span>
                      <span className="mt-2 text-[13px] font-bold">{rotulo}</span>
                      <span className="text-[12px] font-medium text-tinta/60">{dica}</span>
                      <span className="mt-auto flex items-end justify-between gap-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_rgba(11,11,15,0.06)]">
                          <Icone aria-hidden className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="text-[11.5px] font-bold tabular-nums text-tinta/60">{parte}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ---------------------------------- leads: filtros + cartão preto */}
          <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">
                  Leads{' '}
                  <span className="text-[14px] font-bold tabular-nums text-zinc-500">
                    {total.toLocaleString('pt-BR')} {temFiltro || niveis.length ? 'nesta lista' : 'no total'}
                  </span>
                </h2>
                {total > 0 && (
                  <button
                    onClick={() => { setConfirmandoLote(true); setTextoConfirma(''); }}
                    title={temFiltro ? 'Apagar os leads que estão filtrados agora' : 'Apagar todos os leads'}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold text-zinc-500 transition-colors hover:bg-rosa hover:text-red-800"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    {temFiltro ? `Excluir os ${total}` : 'Excluir todos'}
                  </button>
                )}
              </div>

              <div className="mt-4 rounded-[22px] bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 md:p-4">
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                <Pilula titulo="Ordem da lista" value={ordem} onChange={(v) => { setOrdem(v as typeof ordem); setPagina(0); }}>
                  <option value="temperatura">Mais quentes primeiro</option>
                  <option value="recentes">Mais recentes</option>
                  <option value="avaliacoes">Mais avaliados</option>
                  <option value="nome">Ordem alfabética</option>
                </Pilula>
                <Pilula titulo="Cidade" value={cidade} onChange={(v) => { setCidade(v); setPagina(0); }} largura="max-w-[220px]">
                  <option value="">Todas as cidades</option>
                  {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
                </Pilula>
                <Pilula titulo="Categoria" value={categoria} onChange={(v) => { setCategoria(v); setPagina(0); }} largura="max-w-[220px]">
                  <option value="">Todas as categorias</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </Pilula>
                {equipe.length > 1 && (
                  <Pilula titulo="Quem está cuidando do lead" value={dePessoa} onChange={(v) => { setDePessoa(v); setPagina(0); }}>
                    <option value="">Todo mundo</option>
                    <option value={usuario}>Meus ({resumo['de_' + usuario] || 0})</option>
                    <option value="ninguem">Sem dono ({resumo.de_ninguem || 0})</option>
                    {equipe.filter((n) => n !== usuario).map((n) => (
                      <option key={n} value={n}>
                        De {n} ({resumo['de_' + n] || 0})
                      </option>
                    ))}
                  </Pilula>
                )}
                <Alternador ligado={comTelefone} onClick={() => { setComTelefone((v) => !v); setPagina(0); }}>
                  Só com telefone
                </Alternador>
                {(resumo.site_quebrado ?? 0) > 0 && (
                  <Alternador
                    ligado={siteQuebrado}
                    onClick={() => { setSiteQuebrado((v) => !v); setPagina(0); }}
                    titulo="Comércios cujo site cadastrado no Google não está de pé"
                  >
                    Site não está de pé <span className="tabular-nums opacity-60">{resumo.site_quebrado}</span>
                  </Alternador>
                )}
              </div>

              <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-zinc-200 pb-1 pt-3 md:flex-wrap md:overflow-visible md:pb-0">
                <span className="mr-1 shrink-0 text-[12px] font-bold text-zinc-600">Status</span>
                {STATUS.map((s) => {
                  const ativo = statusFiltro.includes(s.valor);
                  return (
                    <button
                      key={s.valor}
                      onClick={() => alternar(statusFiltro, setStatusFiltro, s.valor)}
                      aria-pressed={ativo}
                      className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] font-bold ring-1 transition-colors duration-150 ${
                        ativo ? 'bg-tinta text-white ring-tinta' : s.classe + ' ring-inset hover:ring-zinc-400'
                      }`}
                    >
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ativo ? 'bg-white' : s.ponto}`} />
                      {s.rotulo} <span className="tabular-nums opacity-60">{resumo['status_' + s.valor] || 0}</span>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>

            {cartaoAcao('hidden md:flex')}
          </section>

          {/* --------------------------------------------------- tabela */}
          <section className="mt-6" aria-label="Lista de leads">
            {/* no celular a tabela vira cartões: sete colunas em 375px seria
                rolagem lateral justamente na hora de ligar para o comércio */}
            <div className="space-y-3 md:hidden">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  usuario={usuario}
                  statusLista={STATUS}
                  tipo={tipoDe(lead.websiteKind)}
                  siteStatus={lead.siteStatus ? SITE_STATUS[lead.siteStatus] ?? null : null}
                  linkWhatsApp={linkWhatsApp(lead)}
                  onStatus={(st) => salvarPatch(lead.id, { status: st })}
                  onPrompt={() => { setVariantePrompt('abordagem'); setPromptDe(lead); }}
                  onApagar={() => apagar(lead.id, lead.name)}
                  onPromptGringa={() => { setVariantePrompt('gringa'); setPromptDe(lead); }}
                  onPromptDesign={() => { setVariantePrompt('design'); setPromptDe(lead); }}
                  onPromptSite={() => { setVariantePrompt('site'); setPromptDe(lead); }}
                  onProposta={() => setPropostaDe(lead)}
                  onFicha={(aba) => setFicha({ id: lead.id, aba })}
                  onNota={() => { setNotaAberta(lead.id); setRascunho(lead.notes || ''); }}
                  editandoNota={notaAberta === lead.id}
                  rascunho={rascunho}
                  setRascunho={setRascunho}
                  onSalvarNota={() => { salvarPatch(lead.id, { notes: rascunho }); setNotaAberta(null); }}
                  onCancelarNota={() => setNotaAberta(null)}
                />
              ))}
            </div>
            {cartaoAcao('mt-6 flex md:hidden')}

            <div className="hidden overflow-x-auto rounded-[24px] border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(11,11,15,0.05)] md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-zinc-50 text-[11.5px] font-bold uppercase tracking-[0.04em] text-zinc-600">
                  <tr className="border-b border-zinc-200">
                    <th className="py-3 pl-5 pr-4 font-bold">Comércio</th>
                    <th className="px-4 py-3 font-semibold">Presença digital</th>
                    <th className="px-4 py-3 font-semibold">Contato</th>
                    <th className="px-4 py-3 font-semibold">Onde fica</th>
                    <th className="px-4 py-3 text-center font-semibold">Reputação</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="sticky right-0 z-10 bg-zinc-50 px-3 py-3"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const t = tipoDe(lead.websiteKind);
                    const zap = linkWhatsApp(lead);
                    const temp = temperaturaDoLead(lead);
                    const situacao = lead.siteStatus ? SITE_STATUS[lead.siteStatus] : null;
                    return (
                      <tr key={lead.id} className="group border-b border-zinc-200 align-top transition-colors duration-150 last:border-b-0 hover:bg-zinc-50">
                        <td className="py-4 pl-5 pr-4">
                          <div className="flex items-start gap-3">
                            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tinta text-[15px] font-extrabold text-white">
                              {inicial(lead.name)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold leading-snug">{lead.name}</span>
                                <span
                                  title={[
                                    `${temp.rotulo} — ${temp.pontos} de 100`,
                                    ...temp.motivos.map((m) => '• ' + m),
                                    ...temp.freios.map((f) => '⚠ ' + f),
                                  ].join(String.fromCharCode(10))}
                                  className={`shrink-0 cursor-help rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${CLASSE_NIVEL[temp.nivel]}`}
                                >
                                  {temp.rotulo} {temp.pontos}
                                </span>
                              </div>
                              {lead.category && <div className="mt-0.5 text-[12px] font-medium text-zinc-500">{lead.category}</div>}
                              {lead.propostaAberturas > 0 && (
                                <div className="mt-1.5">
                                  <SeloProposta abertaEm={lead.propostaAbertaEm} aberturas={lead.propostaAberturas} primeiraEm={lead.propostaPrimeiraEm} />
                                </div>
                              )}
                              {lead.lembreteEm && (
                                <button
                                  type="button"
                                  onClick={() => setFicha({ id: lead.id, aba: 'lembrete' })}
                                  title={lead.lembreteTexto || 'Lembrete'}
                                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                                    new Date(lead.lembreteEm).getTime() < Date.now() ? 'bg-tinta text-white ring-tinta' : 'bg-white text-tinta ring-zinc-300'
                                  }`}
                                >
                                  <Bell aria-hidden className="h-3 w-3" />
                                  {new Date(lead.lembreteEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </button>
                              )}
                              {notaAberta === lead.id ? (
                                <div className="mt-2">
                                  <textarea
                                    value={rascunho}
                                    onChange={(e) => setRascunho(e.target.value)}
                                    rows={3}
                                    autoFocus
                                    placeholder="O que rolou nesse contato…"
                                    className="w-full min-w-[240px] rounded-xl border border-roxo-300 px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-roxo-100"
                                  />
                                  <div className="mt-1.5 flex gap-2">
                                    <button
                                      onClick={() => { salvarPatch(lead.id, { notes: rascunho }); setNotaAberta(null); }}
                                      className="min-h-[32px] rounded-full bg-tinta px-4 text-[12px] font-bold text-white hover:bg-tinta-70"
                                    >
                                      Salvar
                                    </button>
                                    <button onClick={() => setNotaAberta(null)} className="min-h-[32px] px-2 text-[12px] font-semibold text-zinc-500 hover:text-tinta">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setNotaAberta(lead.id); setRascunho(lead.notes || ''); }}
                                  className="mt-1 block max-w-[260px] truncate text-left text-[12px] font-semibold text-roxo-700 hover:underline"
                                >
                                  {lead.notes ? `“${lead.notes}”` : '+ anotação'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <Selo classe={t.classe} ponto={t.barra}>{t.rotulo}</Selo>
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="mt-1.5 block max-w-[200px] truncate text-[12px] text-zinc-500 hover:text-roxo-700 hover:underline"
                              title={lead.website}
                            >
                              {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          )}
                          {lead.instagram && (
                            <a
                              href={lead.instagram}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="mt-1 block text-[12px] text-zinc-500 hover:text-roxo-700 hover:underline"
                            >
                              {'@' + lead.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              title={lead.email}
                              className="mt-1 block max-w-[220px] truncate text-[12px] text-zinc-500 hover:text-roxo-700 hover:underline"
                            >
                              {lead.email}
                            </a>
                          )}
                          {situacao && (
                            <div className={`mt-1 flex items-center gap-1 text-[11.5px] ${situacao.classe}`} title={lead.siteDetalhe || ''}>
                              {!situacao.bom && <AlertTriangle aria-hidden className="h-3.5 w-3.5" />}
                              {situacao.rotulo}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {lead.phone || zap ? (
                            <div className="flex flex-col items-start gap-1.5">
                              {lead.phone && (
                                <button
                                  onClick={() => copiar(lead.phone!, lead.id)}
                                  className="text-left font-bold tabular-nums text-tinta hover:text-roxo-700"
                                  title="Clique para copiar"
                                >
                                  {copiado === lead.id ? 'copiado!' : lead.phone}
                                </button>
                              )}
                              {zap && (
                                <button
                                  type="button"
                                  onClick={() => setFicha({ id: lead.id, aba: 'whatsapp' })}
                                  title="Abre a mensagem pronta para este comércio"
                                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold text-tinta transition-colors hover:border-zinc-400"
                                >
                                  <MessageCircle aria-hidden className="h-3 w-3" />
                                  WhatsApp
                                  {lead.whatsappFonte === 'link' && <span className="font-semibold text-emerald-700">· confirmado</span>}
                                </button>
                              )}
                              {!zap && lead.telefoneTipo === 'fixo' && (
                                <span className="text-[11px] font-semibold text-zinc-400">fixo · sem WhatsApp</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-zinc-400">sem telefone</span>
                          )}
                        </td>

                        <td className="max-w-[240px] px-4 py-4">
                          <div className="truncate text-zinc-700" title={lead.address || ''}>
                            {lead.address || '—'}
                          </div>
                          {lead.city && <div className="mt-0.5 text-[12px] font-medium text-zinc-500">{lead.city}</div>}
                        </td>

                        <td className="px-4 py-4 text-center">
                          {lead.rating ? (
                            <>
                              <div className="font-bold tabular-nums">{lead.rating.toFixed(1)}</div>
                              <div className="text-[11.5px] text-zinc-500">{lead.reviews ?? 0} aval.</div>
                            </>
                          ) : (
                            <span className="text-[12px] text-zinc-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="relative inline-flex">
                            <select
                              value={lead.status}
                              onChange={(e) => salvarPatch(lead.id, { status: e.target.value as Status })}
                              aria-label={`Status de ${lead.name}`}
                              className="min-h-[34px] cursor-pointer appearance-none rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-8 text-[12px] font-semibold outline-none transition-colors hover:border-zinc-400 focus-visible:border-roxo-500"
                            >
                              {STATUS.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
                            </select>
                            <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                          </span>
                          {lead.responsavel && (
                            <div
                              className={`mt-1.5 text-[11.5px] ${
                                lead.responsavel === usuario ? 'font-bold text-roxo-700' : 'font-semibold text-amber-800'
                              }`}
                              title={
                                lead.responsavel === usuario
                                  ? 'Você está cuidando deste'
                                  : `${lead.responsavel} já está cuidando deste — combine antes de ligar`
                              }
                            >
                              {lead.responsavel === usuario ? 'com você' : `com ${lead.responsavel}`}
                            </div>
                          )}
                        </td>

                        {/*
                          Grudada na direita e em grade de dois.
                          Em fila única, com COPY, DESIGN, PROPOSTA e
                          às vezes ENTREGA e COPY GRINGA, esta célula sozinha
                          pedia 315px — um terço da tabela — e o resto saía da
                          tela. A largura mora no div, não na célula: `w-` numa
                          <td> é só sugestão e a tabela reparte o espaço como quer.
                        */}
                        <td className="sticky right-0 z-10 bg-white px-3 py-4 align-top shadow-[-10px_0_12px_-12px_rgba(11,11,15,0.18)] transition-colors duration-150 group-hover:bg-zinc-50">
                          <div className="grid w-[190px] grid-cols-2 gap-1.5">
                            <Acao
                              onClick={() => { setVariantePrompt('abordagem'); setPromptDe(lead); }}
                              titulo="Gera o prompt de abordagem deste lead para colar no ChatGPT"

                            >
                              COPY
                            </Acao>
                            {origemDoLead(lead).estrangeiro && (
                              <Acao
                                onClick={() => { setVariantePrompt('gringa'); setPromptDe(lead); }}
                                titulo={`Lead de fora do Brasil (${origemDoLead(lead).motivo}). Gera o prompt do e-mail para colar na SkynetChat.`}

                              >
                                COPY GRINGA
                              </Acao>
                            )}
                            <Acao
                              onClick={() => { setVariantePrompt('design'); setPromptDe(lead); }}
                              titulo="Antes da venda: prompt para desenhar a prévia no Claude Design"
                              feito={Boolean(lead.previaUrl)}
                            >
                              DESIGN
                            </Acao>
                            {lead.previaUrl && (
                              <Acao
                                onClick={() => { setVariantePrompt('site'); setPromptDe(lead); }}
                                titulo="Depois da venda: prompt para publicar o site aprovado no Claude Code"
                              >
                                ENTREGA
                              </Acao>
                            )}
                            <Acao
                              onClick={() => setPropostaDe(lead)}
                              titulo="Monta os três planos de proposta para este lead"
                              feito={Boolean(lead.proposta)}
                            >
                              PROPOSTA
                            </Acao>
                            <Acao
                              onClick={() => setFicha({ id: lead.id, aba: 'historico' })}
                              titulo="Mensagem do WhatsApp, lembrete e histórico deste lead"
                            >
                              FICHA
                            </Acao>
                          </div>
                          <div className="mt-2 flex w-[190px] items-center gap-3 px-1">
                            {lead.mapsUrl && (
                              <a
                                href={lead.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-roxo-700"
                              >
                                <MapPin aria-hidden className="h-3.5 w-3.5" />
                                Maps
                              </a>
                            )}
                            <button
                              onClick={() => apagar(lead.id, lead.name)}
                              className="text-[12px] font-semibold text-zinc-400 hover:text-red-700"
                            >
                              apagar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!leads.length && !carregando && (
              <div className="mt-2 rounded-[24px] bg-zinc-50 px-6 py-14 text-center">
                <p className="text-[16px] font-extrabold tracking-[-0.01em]">
                  {resumo.total ? 'Nenhum lead com esses filtros.' : 'Nenhum lead ainda.'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-zinc-600">
                  {resumo.total
                    ? 'Afrouxe os filtros acima para ver mais resultados.'
                    : 'Escolha os tipos de comércio e a cidade em Buscar leads. Os que não têm site aparecem aqui.'}
                </p>
                <p className="mt-5 flex flex-wrap justify-center gap-2">
                  {resumo.total ? (
                    <button onClick={limparFiltros} className="min-h-[40px] rounded-full bg-tinta px-5 text-[13px] font-bold text-white hover:bg-tinta-70">
                      Limpar filtros
                    </button>
                  ) : (
                    <>
                      <a href="/buscar" className="inline-flex min-h-[40px] items-center rounded-full bg-tinta px-5 text-[13px] font-bold text-white hover:bg-tinta-70">
                        Buscar leads
                      </a>
                      <button
                        onClick={() => setCadastrando(true)}
                        className="min-h-[40px] rounded-full border border-zinc-300 bg-white px-5 text-[13px] font-bold text-tinta hover:border-zinc-500"
                      >
                        Cadastrar à mão
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}

            {carregando && !leads.length && (
              <div className="space-y-2" aria-label="Carregando">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-zinc-100 py-4">
                    <span className="h-10 w-10 animate-pulse rounded-xl bg-zinc-100" />
                    <span className="h-3 w-48 animate-pulse rounded-full bg-zinc-100" />
                  </div>
                ))}
              </div>
            )}

            {/* ------------------------------------------------ paginação */}
            {total > PAGINA && (
              <div className="mt-5 flex items-center justify-between text-[13px]">
                <span className="font-semibold tabular-nums text-zinc-500">
                  {pagina * PAGINA + 1}–{Math.min((pagina + 1) * PAGINA, total)} de {total.toLocaleString('pt-BR')}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagina === 0}
                    onClick={() => { setPagina((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="min-h-[40px] rounded-full border border-zinc-200 px-4 font-bold disabled:opacity-40 enabled:hover:border-zinc-400"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={ultimaPagina}
                    onClick={() => { setPagina((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="min-h-[40px] rounded-full bg-tinta px-4 font-bold text-white disabled:opacity-40 enabled:hover:bg-tinta-70"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {cadastrando && (
        <CadastroModal aoFechar={() => setCadastrando(false)} aoSalvar={carregar} />
      )}

      {ficha && (
        <FichaLead key={ficha.id + ficha.aba} leadId={ficha.id} abaInicial={ficha.aba} aoFechar={() => setFicha(null)} aoMudar={carregar} />
      )}

      {/* ---------------------------- confirmar exclusão em lote */}
      {confirmandoLote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4"
          onClick={() => { setConfirmandoLote(false); setTextoConfirma(''); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[24px] bg-white p-7 shadow-[0_24px_60px_rgba(11,11,15,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-red-900">
              {temFiltro ? `Apagar os ${total} leads desta lista?` : `Apagar TODOS os ${total} leads?`}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
              Some tudo junto: anotações, propostas montadas e links de prévia. Não dá para desfazer,
              e o que veio do Maps só volta com outra varredura.
              {temFiltro
                ? ' Só os que estão filtrados agora vão sair.'
                : ' Nenhum filtro está ativo — isso é a base inteira.'}
            </p>

            <label className="mt-5 block text-[13px] font-medium text-zinc-800">
              Para confirmar, digite <strong>EXCLUIR</strong>:
              <input
                value={textoConfirma}
                onChange={(e) => setTextoConfirma(e.target.value)}
                autoFocus
                aria-label="Digite EXCLUIR para confirmar"
                className="mt-2 block min-h-[44px] w-44 rounded-full border border-zinc-300 px-4 text-[14px] font-semibold outline-none focus:border-red-600"
              />
            </label>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={apagarLote}
                disabled={apagando || textoConfirma.trim().toUpperCase() !== 'EXCLUIR'}
                className="min-h-[44px] rounded-full bg-red-600 px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-red-700 disabled:bg-zinc-300"
              >
                {apagando ? 'Apagando…' : `Apagar ${total}`}
              </button>
              <button
                onClick={() => { setConfirmandoLote(false); setTextoConfirma(''); }}
                className="min-h-[44px] rounded-full border border-zinc-300 px-6 text-[13.5px] font-bold text-tinta"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {promptDe && (
        <PromptModal
          lead={promptDe}
          variante={variantePrompt}
          aoFechar={() => setPromptDe(null)}
          aoSalvarPrevia={async (url) => {
            await salvarPatch(promptDe.id, { previaUrl: url || null });
            setPromptDe((atual) => (atual ? { ...atual, previaUrl: url || null } : atual));
          }}
          aoSalvarBriefing={async (briefing) => {
            await salvarPatch(promptDe.id, { briefing });
            setPromptDe((atual) => (atual ? { ...atual, briefing } : atual));
          }}
        />
      )}

      {propostaDe && (
        <PropostaModal
          lead={propostaDe}
          linkProposta={propostaDe.linkProposta || ''}
          aoFechar={() => setPropostaDe(null)}
          aoSalvar={async (proposta) => {
            await salvarPatch(propostaDe.id, { proposta });
            setPropostaDe((atual) => (atual ? { ...atual, proposta } : atual));
          }}
          aoSalvarCnpj={async (cnpj) => {
            await salvarPatch(propostaDe.id, { cnpj });
            setPropostaDe((atual) => (atual ? { ...atual, cnpj } : atual));
          }}
        />
      )}
    </div>
  );
}
