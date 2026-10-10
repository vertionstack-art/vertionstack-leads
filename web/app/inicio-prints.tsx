import Image from 'next/image';

/**
 * A ferramenta por dentro, na página de venda: prints de verdade tirados de
 * uma conta de demonstração com comércios fictícios (a legenda diz isso).
 * Para refazer, ver VERTION-LEADS-MEMORIA.md ("Prints da página de venda").
 */

const moldura = 'overflow-hidden rounded-[20px] bg-white ring-1 ring-zinc-200 shadow-[0_2px_8px_rgba(11,11,15,0.06)]';

function Legenda({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <figcaption className="mt-3 px-1">
      <span className="block text-[14.5px] font-extrabold tracking-[-0.01em]">{titulo}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-zinc-600">{texto}</span>
    </figcaption>
  );
}

export default function PrintsDaFerramenta() {
  return (
    <section className="border-t border-zinc-200 px-5 py-16 md:px-9 md:py-24" aria-labelledby="t-dentro">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
        <h2 id="t-dentro" className="text-balance text-[32px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[44px]">
          É isso que você vê quando entra.
        </h2>
        <p className="max-w-[460px] text-[15px] font-medium leading-relaxed text-zinc-600">
          Telas reais da ferramenta. Os comércios são fictícios, para mostrar sem expor ninguém.
        </p>
      </div>

      <figure className="mt-10">
        <div className={moldura}>
          <Image
            src="/prints/painel.webp"
            alt="Painel do Vertion Leads: oportunidades por tipo de presença digital, leads quentes, mornos e frios e a lista de comércios"
            width={1600}
            height={1000}
            sizes="(min-width: 1280px) 1170px, 100vw"
            className="h-auto w-full"
          />
        </div>
        <Legenda titulo="O painel" texto="Quantos comércios sem site, quem está quente e a lista pronta para trabalhar." />
      </figure>

      <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.5fr)] lg:items-start">
        <figure>
          <div className={moldura}>
            <Image
              src="/prints/ficha.webp"
              alt="Ficha do lead com a mensagem do WhatsApp já escrita para o comércio"
              width={1000}
              height={913}
              sizes="(min-width: 1024px) 420px, (min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </div>
          <Legenda titulo="Mensagem pronta" texto="Escrita com o motivo daquele comércio. Você revisa e abre no WhatsApp." />
        </figure>
        <figure>
          <div className={moldura}>
            <Image
              src="/prints/crm.webp"
              alt="CRM com a lista Para hoje, etapas do funil e o selo de proposta aberta"
              width={1600}
              height={1000}
              sizes="(min-width: 1024px) 520px, (min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </div>
          <Legenda titulo="CRM com lembretes" texto="O que fazer hoje no topo, e o selo verde quando o cliente abre a proposta." />
        </figure>
        <figure className="mx-auto w-full max-w-[260px] md:col-span-2 lg:col-span-1">
          <div className="overflow-hidden rounded-[28px] bg-white ring-[6px] ring-tinta shadow-[0_2px_8px_rgba(11,11,15,0.06)]">
            <Image
              src="/prints/celular.webp"
              alt="A ficha do lead no celular, com a mensagem pronta para o WhatsApp"
              width={780}
              height={1688}
              sizes="260px"
              className="h-auto w-full"
            />
          </div>
          <Legenda titulo="No celular" texto="Na hora de chamar o comércio." />
        </figure>
      </div>
    </section>
  );
}
