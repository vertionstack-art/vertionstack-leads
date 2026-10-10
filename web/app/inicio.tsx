import Link from 'next/link';
import { ArrowRight, Check, Eye, Flame, Plus, Search, Snowflake, Sun } from 'lucide-react';
import Oportunidades from './inicio-oportunidades';
import ContaDoSite from './inicio-conta';
import { LIMITES, PLANOS_A_VENDA, reais } from '@/lib/planos';
import { responsavel } from '@/lib/legal';
import { PISO_ABSOLUTO } from '@/lib/proposta';

/**
 * A página de venda: o que quem não está logado vê no endereço principal.
 * Quem está logado continua caindo direto no painel (app/page.tsx).
 *
 * Regra do Lucas: nenhum número, cliente ou depoimento inventado. Tudo que
 * aparece aqui é regra da própria ferramenta (lib/classify, lib/temperatura,
 * lib/planos); os comércios de exemplo são fictícios e a página diz isso.
 */

const numero = (n: number) => n.toLocaleString('pt-BR');


const pilulaPreta =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-tinta px-6 text-[14px] font-bold text-white transition-colors hover:bg-tinta-70';

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Vertion Leads, início">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-roxo-200 text-[17px] font-extrabold text-tinta">V</span>
      <span className="text-[15px] font-extrabold tracking-[-0.01em]">Vertion Leads</span>
    </Link>
  );
}

const PASSOS: { verbo: string; titulo: string; texto: string; cena: React.ReactNode }[] = [
  {
    verbo: 'Busque',
    titulo: 'Diga o ramo e a cidade',
    texto:
      'A ferramenta procura no Google e já tira da lista empresa grande, quem tem site próprio escondido e quem não tem como ser contatado. Comércio que já está na sua lista não volta repetido.',
    cena: (
      <div aria-hidden className="flex flex-col gap-2 sm:flex-row">
        <span className="flex min-h-[44px] flex-1 items-center gap-2 rounded-full bg-zinc-100 px-4 text-[13.5px] font-semibold">
          <Search aria-hidden className="h-4 w-4 text-zinc-500" /> Barbearia
        </span>
        <span className="flex min-h-[44px] flex-1 items-center rounded-full bg-zinc-100 px-4 text-[13.5px] font-semibold">Gurupi, TO</span>
        <span className="flex min-h-[44px] items-center justify-center rounded-full bg-zinc-200 px-5 text-[13.5px] font-bold text-zinc-600">Buscar</span>
      </div>
    ),
  },
  {
    verbo: 'Escolha',
    titulo: 'Chame primeiro quem está quente',
    texto:
      'Cada comércio ganha uma temperatura pelo que tem de presença, movimento e reputação. Site quebrado pesa mais que site nenhum: o dono já pagou por um e está perdendo cliente hoje.',
    cena: (
      <div className="grid grid-cols-3 gap-2">
        {[
          { r: 'Quentes', d: 'ligar primeiro', c: 'bg-rosa', I: Flame },
          { r: 'Mornos', d: 'vale tentar', c: 'bg-manteiga', I: Sun },
          { r: 'Frios', d: 'por último', c: 'bg-lavanda', I: Snowflake },
        ].map(({ r, d, c, I }) => (
          <div key={r} className={`rounded-[20px] p-3.5 sm:p-4 ${c}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(11,11,15,0.06)]">
              <I aria-hidden className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <p className="mt-4 text-[14.5px] font-extrabold">{r}</p>
            <p className="text-[12.5px] font-semibold text-tinta/70">{d}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    verbo: 'Aborde',
    titulo: 'Mostre a prévia antes do preço',
    texto:
      'A ferramenta monta o briefing da prévia do site e escreve a mensagem de abordagem em volta dela, usando o motivo daquele comércio. Você revisa, copia e manda.',
    cena: (
      <div className="max-w-[420px] rounded-[20px] rounded-bl-md bg-zinc-100 px-4 py-3 text-[13.5px] leading-relaxed">
        <p>
          Oi, Carlos! Tentei abrir o site da Navalha de Ouro pelo Google e ele não carrega. Fiz uma prévia de como ele
          poderia ficar com as suas 412 avaliações na frente. Posso te mandar?
        </p>
        <p className="mt-1.5 text-[11.5px] font-semibold text-zinc-600">Exemplo de mensagem para um comércio fictício</p>
      </div>
    ),
  },
  {
    verbo: 'Proponha',
    titulo: 'Saiba a hora que o cliente abriu a proposta',
    texto:
      'Preço, prazo e o que entra no site, num link ou PDF com os dados da sua empresa. Quando o cliente abre, o lead ganha um selo verde com quantas vezes ele olhou. E a ferramenta avisa antes da proposta vencer.',
    cena: (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tinta text-[15px] font-extrabold text-white" aria-hidden>
          N
        </span>
        <span>
          <span className="block text-[14px] font-extrabold">Barbearia Navalha de Ouro</span>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-menta px-2.5 py-0.5 text-[12px] font-bold text-emerald-950">
            <Eye aria-hidden className="h-3.5 w-3.5" />
            Proposta aberta há 3 min <span className="tabular-nums opacity-70">· 2×</span>
          </span>
        </span>
      </div>
    ),
  },
  {
    verbo: 'Feche',
    titulo: 'Acompanhe no CRM e veja o dinheiro',
    texto:
      'Funis com as etapas que você quiser, um cartão por cliente, arrastando de uma etapa para a outra. O que fecha cai no Financeiro: clientes, entrada, mensalidade e o que ainda está na mesa.',
    cena: (
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        {[
          { e: 'Proposta enviada', c: ['Pizzaria Forno de Barro'] },
          { e: 'Negociando', c: ['Studio Bella Unhas'] },
          { e: 'Fechado', c: ['Barbearia Navalha de Ouro'] },
        ].map((col, i) => (
          <div key={col.e} className="rounded-2xl bg-zinc-100 p-2">
            <p className="px-1 pb-2 font-bold text-zinc-600">{col.e}</p>
            {col.c.map((c) => (
              <p key={c} className={`rounded-xl px-2.5 py-2 font-bold leading-snug ${i === 2 ? 'bg-tinta text-white' : 'bg-white'}`}>
                {c}
              </p>
            ))}
          </div>
        ))}
      </div>
    ),
  },
];

const DUVIDAS: { p: string; r: React.ReactNode }[] = [
  {
    p: 'Preciso de cartão para testar?',
    r: `Não. O teste grátis libera ${LIMITES.gratis.semana} leads e ${LIMITES.gratis.buscas} buscas, sem cartão. Quando acabar, você escolhe se assina.`,
  },
  {
    p: 'De onde vêm os comércios?',
    r: 'Da busca do Google, a mesma base do Google Maps, no ramo e na cidade que você escolher. A ferramenta confere cada um e só guarda quem é oportunidade.',
  },
  {
    p: 'Como ela sabe se o comércio tem site?',
    r: 'Olha o endereço cadastrado no Google: Instagram, Linktree, iFood, Doctoralia e construtores grátis contam como oportunidade, não como site. Quando não há site cadastrado, ela ainda procura se existe um site com o nome do comércio antes de entregar o lead.',
  },
  {
    p: 'E o WhatsApp?',
    r: 'A ferramenta mostra se o telefone é celular ou fixo e procura o WhatsApp no Linktree e no site do comércio. Na busca dá para pedir só quem tem WhatsApp.',
  },
  {
    p: 'Funciona no celular?',
    r: 'Funciona. A lista de leads vira fichas no celular, para você conferir o motivo e chamar o comércio na hora.',
  },
  {
    p: 'Posso cancelar quando quiser?',
    r: 'Pode. No cartão, a assinatura renova todo mês e você cancela dentro da ferramenta, sem falar com ninguém. O plano de 7 dias é pago uma vez e não renova. Nos planos pagos, a cota de leads renova toda segunda-feira.',
  },
  {
    p: 'O que acontece com os meus dados?',
    r: (
      <>
        Seus leads, propostas e clientes são vistos só pela sua conta, e você pode excluir tudo quando quiser. Os detalhes estão
        na{' '}
        <Link href="/privacidade" className="font-semibold text-roxo-700 underline underline-offset-2">
          Política de privacidade
        </Link>
        .
      </>
    ),
  },
];

function itensDoPlano(p: (typeof PLANOS_A_VENDA)[number]): string[] {
  const lim = LIMITES[p.plano];
  return [
    p.plano === 'gratis' ? `${numero(lim.semana)} leads no total` : `${numero(lim.semana)} leads novos por semana`,
    p.plano === 'gratis'
      ? `${lim.buscas} buscas no Google`
      : p.plano === 'semanal'
        ? `${lim.buscas} buscas no Google nos 7 dias`
        : `${lim.buscas} buscas no Google por mês`,
    lim.funis > 1 ? `CRM com até ${lim.funis} funis` : 'CRM com 1 funil',
    'temperatura, abordagem, proposta e Financeiro',
  ];
}

export default function Inicio() {
  const contato = responsavel().email;

  return (
    <div className="min-h-screen p-2 sm:p-3">
      <div className="mx-auto max-w-[1240px] rounded-[var(--radius-folha)] bg-white">
        {/* topo */}
        <header className="flex items-center justify-between gap-3 px-5 pt-5 md:px-9 md:pt-7">
          <Marca />
          <nav aria-label="Seções da página" className="hidden items-center gap-1 text-[13.5px] font-bold lg:flex">
            {[
              ['#como-funciona', 'Como funciona'],
              ['#conta', 'Quanto rende'],
              ['#planos', 'Planos'],
              ['#duvidas', 'Dúvidas'],
            ].map(([href, rotulo]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-tinta">
                {rotulo}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-[40px] items-center rounded-full px-4 text-[13.5px] font-bold transition-colors hover:bg-zinc-100"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="hidden min-h-[40px] items-center rounded-full bg-tinta px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70 sm:inline-flex"
            >
              Testar grátis
            </Link>
          </div>
        </header>

        <main>
          {/* abertura: a frase, a ação e a barra do que conta como cliente */}
          <section className="px-5 pb-16 pt-12 md:px-9 md:pb-24 md:pt-20" aria-labelledby="titulo">
            <div className="max-w-[860px]">
              <h1
                id="titulo"
                className="text-balance text-[42px] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-[56px] lg:text-[72px]"
              >
                Ache quem ainda não tem{' '}
                <span className="inline-block -rotate-2 rounded-full border-2 border-tinta px-4 leading-[1.08] lg:px-5">site</span>. E
                venda o site para ele.
              </h1>
              <div className="mt-6 md:mt-7">
                <p className="max-w-[560px] text-[16px] font-medium leading-relaxed text-zinc-600 md:text-[18px]">
                  Busca comércios no Google da sua cidade e entrega só quem precisa de site, pronto para abordar.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href="/cadastro" className={pilulaPreta}>
                    Testar grátis com {LIMITES.gratis.semana} leads
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                  <span className="text-[13px] font-semibold text-zinc-500">Sem cartão de crédito</span>
                </div>
              </div>
            </div>

            <div className="mt-12 md:mt-16">
              <h2 className="mb-5 text-[22px] font-extrabold tracking-[-0.02em] md:text-[26px]">
                Instagram não é site. <span className="text-roxo-700">É oportunidade.</span>
              </h2>
              <Oportunidades
                meio={
                  <div className="mb-6 mt-20 grid gap-4 md:mt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
                    <h2 className="text-balance text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
                      Cada lead chega quente, morno ou frio. E com o porquê.
                    </h2>
                    <p className="max-w-[460px] text-[15px] font-medium leading-relaxed text-zinc-600">
                      O motivo não é enfeite: é a frase que você usa na conversa. Use os filtros da lista para ver só um tipo de
                      comércio.
                    </p>
                  </div>
                }
              />
            </div>
          </section>

          {/* do lead ao dinheiro */}
          <section id="como-funciona" className="scroll-mt-4 border-t border-zinc-200 px-5 py-16 md:px-9 md:py-24" aria-labelledby="t-como">
            <h2 id="t-como" className="max-w-[760px] text-balance text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
              Do primeiro oi ao dinheiro na conta, num lugar só.
            </h2>
            <ol className="relative mt-12 md:mt-16">
              {/* o trilho preto que liga os passos */}
              <span aria-hidden className="absolute bottom-6 left-[11px] top-3 w-[2px] rounded-full bg-zinc-200 md:left-[15px]" />
              {PASSOS.map((p) => (
                <li
                  key={p.verbo}
                  className="relative grid gap-4 pb-12 pl-10 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10 md:pb-16 md:pl-14"
                >
                  <span aria-hidden className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-tinta md:h-8 md:w-8">
                    <span className="h-2 w-2 rounded-full bg-tinta md:h-2.5 md:w-2.5" />
                  </span>
                  <p className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[34px]">{p.verbo}</p>
                  <div>
                    <h3 className="text-[18px] font-extrabold tracking-[-0.02em]">{p.titulo}</h3>
                    <p className="mt-2 max-w-[460px] text-[14.5px] leading-relaxed text-zinc-600">{p.texto}</p>
                  </div>
                  <div className="self-center">{p.cena}</div>
                </li>
              ))}
            </ol>
          </section>

          {/* a conta: um site paga a ferramenta */}
          <section id="conta" className="scroll-mt-4 border-t border-zinc-200 px-5 py-16 md:px-9 md:py-24" aria-labelledby="t-conta">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
              <h2 id="t-conta" className="text-balance text-[34px] font-extrabold leading-[1] tracking-[-0.04em] md:text-[54px]">
                De 100 comércios, feche 1. <span className="text-emerald-800">A ferramenta já se pagou.</span>
              </h2>
              <div className="max-w-[480px] space-y-3 text-[15px] font-medium leading-relaxed text-zinc-600">
                <p>
                  <b className="text-tinta">O resto é lucro.</b> Você não precisa virar vendedor nato: precisa conversar com quem
                  precisa de site. Essa lista é o que a ferramenta entrega.
                </p>
                <p>
                  Caro não é a assinatura. Caro é a tarde inteira abrindo ficha por ficha no Maps e terminar o dia sem nenhuma
                  proposta enviada.
                </p>
              </div>
            </div>
            <div className="mt-10">
              <ContaDoSite precoInicial={PISO_ABSOLUTO} />
            </div>
          </section>

          {/* planos */}
          <section id="planos" className="scroll-mt-4 border-t border-zinc-200 px-5 py-16 md:px-9 md:py-24" aria-labelledby="t-planos">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
              <h2 id="t-planos" className="text-balance text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
                Comece grátis. Assine depois de ver o primeiro cliente na lista.
              </h2>
              <p className="max-w-[480px] text-[15px] font-medium leading-relaxed text-zinc-600">
                Todo plano tem a ferramenta inteira: busca, temperatura, abordagem, proposta, CRM e Financeiro. O que muda é o
                quanto você prospecta.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PLANOS_A_VENDA.map((p) => {
                const escuro = p.plano === 'pro';
                const gratis = p.precoCentavos === 0;
                return (
                  <article
                    key={p.plano}
                    className={`flex flex-col rounded-[24px] p-6 ${escuro ? 'bg-tinta text-white' : 'bg-white ring-1 ring-inset ring-zinc-200'}`}
                  >
                    <h3 className="text-[20px] font-extrabold tracking-[-0.02em]">{p.nome}</h3>
                    <p className={`mt-1 text-[13px] ${escuro ? 'text-white/70' : 'text-zinc-600'}`}>{p.resumo}</p>
                    <p className="mt-6 flex items-baseline gap-1">
                      <span className="text-[38px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                        {gratis ? 'Grátis' : reais(p.precoCentavos)}
                      </span>
                      {!gratis && (
                        <span className={`whitespace-nowrap text-[13px] font-semibold ${escuro ? 'text-white/60' : 'text-zinc-500'}`}>{p.periodo}</span>
                      )}
                    </p>
                    <ul className="mt-6 space-y-2.5 text-[13.5px]">
                      {itensDoPlano(p).map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-8">
                      <Link
                        href="/cadastro"
                        className={`flex min-h-[44px] items-center justify-center rounded-full text-[13.5px] font-bold transition-colors ${
                          escuro
                            ? 'bg-ceu text-tinta hover:bg-white'
                            : gratis
                              ? 'bg-tinta text-white hover:bg-tinta-70'
                              : 'ring-1 ring-inset ring-zinc-300 hover:ring-tinta'
                        }`}
                      >
                        {gratis ? 'Começar o teste' : p.plano === 'semanal' ? 'Assinar 7 dias' : `Assinar o ${p.nome}`}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 text-[13px] font-medium text-zinc-500">
              Todo plano começa pela conta grátis: você cria a conta, testa e assina dentro da ferramenta quando quiser.
            </p>
          </section>

          {/* dúvidas */}
          <section id="duvidas" className="scroll-mt-4 border-t border-zinc-200 px-5 py-16 md:px-9 md:py-24" aria-labelledby="t-duvidas">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
              <div>
                <h2 id="t-duvidas" className="text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
                  Dúvidas
                </h2>
                <p className="mt-4 max-w-[320px] text-[14.5px] leading-relaxed text-zinc-600">
                  Não achou a sua? Escreva para{' '}
                  <a href={`mailto:${contato}`} className="font-semibold text-roxo-700 underline underline-offset-2">
                    {contato}
                  </a>
                  .
                </p>
              </div>
              <div className="border-t border-zinc-200">
                {DUVIDAS.map((d) => (
                  <details key={d.p} className="group border-b border-zinc-200">
                    <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-extrabold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                      {d.p}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 transition-transform duration-200 group-open:rotate-45">
                        <Plus aria-hidden className="h-4 w-4" />
                      </span>
                    </summary>
                    <p className="max-w-[620px] pb-5 pr-12 text-[14.5px] leading-relaxed text-zinc-600">{d.r}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* fecho */}
          <section className="px-2 pb-2 sm:px-3 sm:pb-3" aria-labelledby="t-fim">
            <div className="relative isolate overflow-hidden rounded-[24px] bg-tinta px-6 py-14 text-white md:px-12 md:py-20">
              <h2 id="t-fim" className="max-w-[720px] text-balance text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[54px]">
                Seu próximo cliente ainda não tem site.
              </h2>
              <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-white/70">
                Faça a primeira busca na sua cidade e veja quem está esperando por você. {LIMITES.gratis.semana} leads grátis, sem
                cartão.
              </p>
              <Link
                href="/cadastro"
                className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ceu px-6 text-[14px] font-bold text-tinta transition-colors hover:bg-white"
              >
                Testar grátis com {LIMITES.gratis.semana} leads
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 px-5 py-7 text-[12.5px] font-medium text-zinc-500 md:px-9">
          <p>Vertion Leads é um produto da Vertion Stack.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/termos" className="hover:text-tinta hover:underline">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="hover:text-tinta hover:underline">
              Política de privacidade
            </Link>
            <a href={`mailto:${contato}`} className="hover:text-tinta hover:underline">
              {contato}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
