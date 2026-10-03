import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { cotaDaConta, sessaoAtual } from '@/lib/conta';
import { LIMITES, NOME_DO_PLANO, PLANOS_A_VENDA, reais } from '@/lib/planos';

export const dynamic = 'force-dynamic';

const numero = (n: number) => n.toLocaleString('pt-BR');

/** o piso de preço de um site na proposta (lib/proposta): é o argumento de que o plano se paga */
const PISO_DE_UM_SITE = 38745;

export default async function PaginaPlanos() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const cota = await cotaDaConta(sessao.contaId, sessao.plano);
  const contato = process.env.EMPRESA_EMAIL || 'vertionstack@gmail.com';

  return (
    <div className="min-h-screen px-3 py-3">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1100px] rounded-[var(--radius-folha)] bg-white px-5 pb-12 pt-7 md:px-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">Planos</h1>
            <p className="mt-1.5 text-[13px] font-medium text-zinc-500">
              Você está no <b className="text-tinta">{NOME_DO_PLANO[sessao.plano]}</b>
              {!cota.ilimitado && (
                <>
                  {' '}· {numero(cota.usados)} de {numero(cota.limite)} leads novos nesta semana · {numero(cota.guardados)} de{' '}
                  {numero(cota.tetoGuardados)} guardados
                </>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-zinc-200 px-4 text-[13px] font-bold transition-colors hover:border-zinc-400"
          >
            Voltar ao painel
          </Link>
        </header>

        <section className="mt-9 grid gap-4 md:grid-cols-3" aria-label="Planos disponíveis">
          {PLANOS_A_VENDA.map((p) => {
            const lim = LIMITES[p.plano];
            const atual = sessao.plano === p.plano;
            const escuro = p.plano === 'pro';
            const assunto = encodeURIComponent(`Quero assinar o plano ${p.nome}`);
            const corpo = encodeURIComponent(`Oi! Quero assinar o plano ${p.nome} do Vertion Leads.\nMinha conta: ${sessao.email}`);
            return (
              <article
                key={p.plano}
                className={`flex flex-col rounded-[24px] p-6 ${
                  escuro ? 'bg-tinta text-white' : p.plano === 'basic' ? 'bg-ceu' : 'bg-zinc-50'
                } ${atual ? 'ring-2 ring-roxo-600 ring-offset-2' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">{p.nome}</h2>
                  {atual && (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${escuro ? 'bg-white text-tinta' : 'bg-tinta text-white'}`}>
                      Seu plano
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-[13px] ${escuro ? 'text-white/70' : 'text-zinc-600'}`}>{p.resumo}</p>

                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-[38px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                    {p.precoCentavos ? reais(p.precoCentavos) : 'Grátis'}
                  </span>
                  {p.precoCentavos > 0 && <span className={`text-[13px] font-semibold ${escuro ? 'text-white/60' : 'text-zinc-500'}`}>/mês</span>}
                </p>

                <ul className="mt-6 space-y-2.5 text-[13.5px]">
                  {[
                    `${numero(lim.semana)} leads novos por semana`,
                    `até ${numero(lim.guardados)} leads guardados`,
                    lim.pessoas > 1 ? `até ${lim.pessoas} pessoas na mesma conta` : '1 pessoa na conta',
                    `extensão em ${lim.aparelhos} computadores`,
                    'temperatura, prévia, copy, proposta e entrega',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${escuro ? 'text-white' : 'text-tinta'}`} strokeWidth={2.4} />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  {atual ? (
                    <span className={`flex min-h-[44px] items-center justify-center rounded-full text-[13.5px] font-bold ${escuro ? 'bg-white/10' : 'bg-white'}`}>
                      Plano atual
                    </span>
                  ) : p.precoCentavos === 0 ? (
                    <span className={`flex min-h-[44px] items-center justify-center rounded-full text-[13px] font-semibold ${escuro ? 'text-white/60' : 'text-zinc-500'}`}>
                      Volta sozinho quando a assinatura vence
                    </span>
                  ) : (
                    <a
                      href={`mailto:${contato}?subject=${assunto}&body=${corpo}`}
                      className={`flex min-h-[44px] items-center justify-center rounded-full text-[13.5px] font-bold transition-colors ${
                        escuro ? 'bg-ceu text-tinta hover:bg-white' : 'bg-tinta text-white hover:bg-tinta-70'
                      }`}
                    >
                      Assinar o {p.nome}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-zinc-200 p-6">
            <h2 className="text-[17px] font-extrabold">Um site vendido paga o plano</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">
              Um único site no preço mínimo da proposta ({reais(PISO_DE_UM_SITE)}) paga{' '}
              <b className="text-tinta">{Math.floor(PISO_DE_UM_SITE / 3790)} meses de Basic</b> ou{' '}
              <b className="text-tinta">{Math.floor(PISO_DE_UM_SITE / 6790)} meses de Pro</b>.
            </p>
          </div>
          <div className="rounded-[24px] bg-zinc-50 p-6">
            <h2 className="text-[17px] font-extrabold">Como assinar</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-600">
              O pagamento automático por Pix e cartão chega em breve. Por enquanto, clique em assinar e a gente
              libera a sua conta assim que o pagamento cair. A cota da semana renova toda segunda-feira.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
