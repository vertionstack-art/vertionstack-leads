'use client';

import { useState } from 'react';
import { Flame, MessageCircle, Phone, Snowflake, Star, Sun } from 'lucide-react';

/**
 * A barra da presença digital da página de venda e a lista de exemplo logo
 * abaixo dela. Tocar num pedaço da barra acende os comércios daquele tipo na
 * lista — é a mesma barra do painel, então quem assina reconhece na hora.
 *
 * Os comércios da lista são fictícios (a página diz isso): busca de verdade
 * custa dinheiro no Google e só acontece dentro da conta.
 */

type Tipo = 'none' | 'social' | 'marketplace' | 'weak';
type Nivel = 'quente' | 'morno' | 'frio';

const TIPOS: { kind: Tipo; rotulo: string; exemplos: string; porque: string; barra: string; texto: string }[] = [
  {
    kind: 'none',
    rotulo: 'Sem site',
    exemplos: 'Só a ficha no Google Maps',
    porque: 'Quem procura o serviço na região acha o concorrente.',
    barra: 'bg-tinta',
    texto: 'text-white',
  },
  {
    kind: 'social',
    rotulo: 'Só rede social',
    exemplos: 'Instagram, Facebook, Linktree',
    porque: 'Audiência alugada, que some se a conta cair.',
    barra: 'bg-roxo-600',
    texto: 'text-white',
  },
  {
    kind: 'marketplace',
    rotulo: 'Só marketplace',
    exemplos: 'iFood, Doctoralia, VivaReal',
    porque: 'Paga comissão por cliente que poderia ser só dele.',
    barra: 'bg-roxo-400',
    texto: 'text-tinta',
  },
  {
    kind: 'weak',
    rotulo: 'Site fraco',
    exemplos: 'Construtor grátis, site fora do ar',
    porque: 'Já pagou por um site e hoje perde cliente com ele.',
    barra: 'bg-roxo-200 ring-1 ring-inset ring-roxo-300',
    texto: 'text-tinta',
  },
];

const NIVEL: Record<Nivel, { rotulo: string; classe: string; Icone: typeof Flame }> = {
  quente: { rotulo: 'Quente', classe: 'bg-rosa text-red-900 ring-red-200', Icone: Flame },
  morno: { rotulo: 'Morno', classe: 'bg-manteiga text-amber-900 ring-amber-200', Icone: Sun },
  frio: { rotulo: 'Frio', classe: 'bg-lavanda text-roxo-900 ring-roxo-200', Icone: Snowflake },
};

const EXEMPLOS: {
  nome: string;
  ramo: string;
  kind: Tipo;
  presenca: string;
  nivel: Nivel;
  nota: string;
  avaliacoes: number;
  celular: boolean;
  motivo: string;
}[] = [
  {
    nome: 'Barbearia Navalha de Ouro',
    ramo: 'Barbearia',
    kind: 'weak',
    presenca: 'Site fora do ar',
    nivel: 'quente',
    nota: '4,8',
    avaliacoes: 412,
    celular: true,
    motivo: 'O site cadastrado não abre, e o dono provavelmente não sabe disso.',
  },
  {
    nome: 'Studio Bella Unhas',
    ramo: 'Manicure e pedicure',
    kind: 'social',
    presenca: 'Só rede social',
    nivel: 'quente',
    nota: '4,9',
    avaliacoes: 186,
    celular: true,
    motivo: 'Cuida do Instagram mas não tem site próprio: já entende o valor, só falta o canal dele.',
  },
  {
    nome: 'Pizzaria Forno de Barro',
    ramo: 'Pizzaria',
    kind: 'marketplace',
    presenca: 'Só marketplace',
    nivel: 'morno',
    nota: '4,4',
    avaliacoes: 97,
    celular: true,
    motivo: 'Depende de plataforma de terceiro e paga comissão por cliente.',
  },
  {
    nome: 'Clínica Sorriso Leve',
    ramo: 'Dentista',
    kind: 'none',
    presenca: 'Sem site',
    nivel: 'morno',
    nota: '4,6',
    avaliacoes: 64,
    celular: false,
    motivo: 'Não tem nenhum site: quem procura o serviço na região acha o concorrente.',
  },
  {
    nome: 'Auto Elétrica Central',
    ramo: 'Auto elétrica',
    kind: 'none',
    presenca: 'Sem site',
    nivel: 'frio',
    nota: '4,0',
    avaliacoes: 5,
    celular: false,
    motivo: 'Poucas avaliações: pode ser negócio novo ou parado. Fica para depois.',
  },
];

const PONTO: Record<Tipo, string> = {
  none: 'bg-tinta',
  social: 'bg-roxo-600',
  marketplace: 'bg-roxo-400',
  weak: 'bg-roxo-200 ring-1 ring-roxo-300',
};

type Props = { ativo: Tipo | null; escolher: (t: Tipo | null) => void; prever: (t: Tipo | null) => void };

export function BarraDaOportunidade({ ativo, escolher, prever }: Props) {
  // o passar do mouse só pré-visualiza; quem fixa é o clique
  const mouse = (t: Tipo | null) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') prever(t);
  };
  return (
    <div className="rounded-[24px] bg-ceu p-4 sm:p-6 md:p-8" onPointerLeave={mouse(null)}>
      {/* a barra: quatro tipos que são cliente, e o "tem site" vazado, o único que fica de fora */}
      <div className="barra-entra flex h-12 gap-[3px] overflow-hidden rounded-full md:h-[76px]">
        {TIPOS.map((t) => (
          <button
            key={t.kind}
            type="button"
            aria-pressed={ativo === t.kind}
            aria-label={t.rotulo}
            onClick={() => escolher(ativo === t.kind ? null : t.kind)}
            onPointerEnter={mouse(t.kind)}
            className={`relative flex-1 cursor-pointer ${t.barra} ${t.texto} transition-opacity duration-300 ease-out md:px-6 md:text-left ${
              ''
            }`}
          >
            <span
              aria-hidden
              className={`absolute inset-0 bg-ceu transition-opacity duration-300 ${ativo && ativo !== t.kind ? 'opacity-60' : 'opacity-0'}`}
            />
            <span
              aria-hidden
              className={`relative hidden md:inline md:text-[17px] md:font-extrabold md:tracking-[-0.02em] ${ativo && ativo !== t.kind ? 'text-tinta' : ''}`}
            >
              {t.rotulo}
            </span>
          </button>
        ))}
        <div className="flex w-[14%] items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-300 md:w-[13%]">
          <span className="hidden text-[14px] font-bold text-zinc-500 line-through decoration-zinc-400 md:inline">Tem site</span>
        </div>
      </div>

      {/* o porquê de cada pedaço; no celular vira a própria lista de botões */}
      <ul className="mt-4 grid gap-2 md:mt-5 md:grid-cols-[1fr_1fr_1fr_1fr_13%] md:gap-[3px]">
        {TIPOS.map((t) => (
          <li key={t.kind}>
            <button
              type="button"
              onClick={() => escolher(ativo === t.kind ? null : t.kind)}
              onPointerEnter={mouse(t.kind)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-[opacity,background-color] duration-300 md:block md:px-6 md:py-1 ${
                ativo === t.kind ? 'bg-white/80 md:bg-transparent' : ativo ? 'opacity-45' : 'hover:bg-white/60 md:hover:bg-transparent'
              }`}
            >
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full md:hidden ${t.barra}`} aria-hidden />
              <span>
                <span className="block text-[14px] font-extrabold md:hidden">{t.rotulo}</span>
                <span className="block text-[13px] font-bold text-tinta md:text-[13.5px]">{t.exemplos}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-zinc-700">{t.porque}</span>
              </span>
            </button>
          </li>
        ))}
        <li className={`px-3 py-1 text-[13px] leading-snug text-zinc-600 transition-opacity md:px-2 ${ativo ? 'opacity-45' : ''}`}>
          <span className="font-bold md:hidden">Tem site: </span>
          Site próprio funcionando não entra na sua lista.
        </li>
      </ul>
    </div>
  );
}

export function ListaDeExemplo({ ativo, escolher }: Omit<Props, 'prever'>) {
  const filtro = (sel: boolean) =>
    `inline-flex min-h-[44px] cursor-pointer md:min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition-colors ${
      sel ? 'bg-tinta text-white' : 'bg-white text-tinta ring-1 ring-inset ring-zinc-200 hover:ring-zinc-400'
    }`;
  return (
    <div className="overflow-hidden rounded-[24px] ring-1 ring-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-3.5">
        <p className="text-[12.5px] font-semibold text-zinc-600">
          Exemplo com comércios fictícios · <span className="text-tinta">Barbearia, dentista, pizzaria… em Gurupi, TO</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de comércio">
          <button type="button" aria-pressed={ativo === null} onClick={() => escolher(null)} className={filtro(ativo === null)}>
            Todos
          </button>
          {TIPOS.map((t) => (
            <button
              key={t.kind}
              type="button"
              aria-pressed={ativo === t.kind}
              onClick={() => escolher(ativo === t.kind ? null : t.kind)}
              className={filtro(ativo === t.kind)}
            >
              <span className={`h-2 w-2 rounded-full ${PONTO[t.kind]} ${ativo === t.kind && t.kind === 'none' ? 'ring-1 ring-white' : ''}`} aria-hidden />
              {t.rotulo}
            </button>
          ))}
        </div>
      </div>
      <ul>
        {EXEMPLOS.map((e) => {
          const n = NIVEL[e.nivel];
          const apagado = ativo !== null && ativo !== e.kind;
          return (
            <li
              key={e.nome}
              className={`grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-zinc-200 px-5 py-4 transition-opacity duration-300 last:border-b-0 md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.6fr)] md:items-center ${
                apagado ? 'opacity-25' : ''
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tinta text-[16px] font-extrabold text-white md:h-10 md:w-10" aria-hidden>
                {e.nome[0]}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14px] font-extrabold">{e.nome}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-inset ${n.classe}`}>
                    <n.Icone aria-hidden className="h-3 w-3" strokeWidth={2.4} />
                    {n.rotulo}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] font-medium text-zinc-500">
                  {e.ramo}
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <Star aria-hidden className="h-3 w-3 fill-tinta text-tinta" />
                    {e.nota} · {e.avaliacoes} avaliações
                  </span>
                </p>
              </div>
              <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto md:flex-col md:items-start md:gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset ring-zinc-200">
                  <span className={`h-2 w-2 rounded-full ${PONTO[e.kind]}`} aria-hidden />
                  {e.presenca}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600">
                  {e.celular ? (
                    <>
                      <MessageCircle aria-hidden className="h-3.5 w-3.5 text-emerald-700" /> Celular, chama no WhatsApp
                    </>
                  ) : (
                    <>
                      <Phone aria-hidden className="h-3.5 w-3.5" /> Telefone fixo
                    </>
                  )}
                </span>
              </div>
              <p className="col-start-2 text-[13px] leading-snug text-zinc-700 md:col-start-auto">
                <span className="font-bold text-tinta">Por quê: </span>
                {e.motivo}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** junta as duas peças com o mesmo destaque; o meio (títulos) vem da página */
export default function Oportunidades({ meio }: { meio: React.ReactNode }) {
  const [ativo, setAtivo] = useState<Tipo | null>(null);
  const [previa, setPrevia] = useState<Tipo | null>(null);
  return (
    <>
      <BarraDaOportunidade ativo={previa ?? ativo} escolher={setAtivo} prever={setPrevia} />
      {meio}
      <ListaDeExemplo ativo={ativo} escolher={setAtivo} />
    </>
  );
}
