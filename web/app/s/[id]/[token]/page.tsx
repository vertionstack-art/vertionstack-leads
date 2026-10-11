import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buscarLead } from '@/lib/db';
import { lerCaminhoDaPrevia } from '@/lib/token-proposta';
import { sessaoAtual } from '@/lib/conta';
import { empresaDaConta } from '@/lib/perfil';
import { lerBriefing } from '@/lib/briefing';
import { horarioEmLinhas, temaDoLead } from '@/lib/previa';
import { numeroWhatsapp } from '@/lib/telefone';
import { registrarEvento } from '@/lib/eventos';
import { db } from '@/lib/sql';
import { estaBloqueado, ipDaRequisicao } from '@/lib/acessos';
import { Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string; token: string }> };

async function leadDaPrevia(id: string, token: string) {
  const alvo = lerCaminhoDaPrevia(id, token);
  if (!alvo) return null;
  const lead = await buscarLead(alvo.conta, alvo.id);
  return lead ? { lead, conta: alvo.conta } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, token } = await params;
  const r = await leadDaPrevia(id, token);
  return {
    title: r ? `${r.lead.name} — prévia do site` : 'Prévia',
    description: r ? `Como o site de ${r.lead.name} poderia ficar.` : undefined,
    robots: { index: false, follow: false },
  };
}

/** "O cliente abriu a prévia" no histórico: sem robô, sem o dono da conta, uma vez a cada 30 min */
async function anotarAbertura(conta: string, leadId: string) {
  const h = await headers();
  const navegador = h.get('user-agent') || '';
  if (!navegador || /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|skype|headless|curl|wget|python/i.test(navegador)) return;
  const quem = await sessaoAtual().catch(() => null);
  if (quem?.contaId === conta) return;
  const [ult] = await db()`
    select criado_em from lead_eventos where conta_id = ${conta} and lead_id = ${leadId} and tipo = 'previa_aberta'
    order by id desc limit 1
  `;
  if (ult && Date.now() - new Date(ult.criado_em).getTime() < 30 * 60 * 1000) return;
  await registrarEvento(conta, leadId, 'previa_aberta', 'Cliente abriu a prévia do site', null);
}

export default async function PreviaDoSite({ params }: Props) {
  const { id, token } = await params;
  if (await estaBloqueado(ipDaRequisicao(await headers()))) notFound();
  const r = await leadDaPrevia(id, token);
  if (!r) notFound();
  const { lead, conta } = r;
  await anotarAbertura(conta, lead.id).catch(() => {});

  const empresa = await empresaDaConta(conta);
  const tema = temaDoLead(lead.category);
  const briefing = lerBriefing(lead.briefing);
  const servicos = briefing.servicos.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 9);
  const diferenciais = briefing.diferenciais.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const listaServicos = servicos.length ? servicos : tema.servicos;
  const porque = diferenciais.length ? diferenciais : tema.porque;
  const frase = briefing.destaque.trim() || tema.frase;
  const horario = horarioEmLinhas(lead.hours);
  const zap = lead.whatsapp || (lead.telefoneTipo === 'fixo' ? null : numeroWhatsapp(lead.phone));
  const linkZap = zap ? `https://wa.me/${zap}?text=${encodeURIComponent(`Olá! Vi o site de vocês e queria mais informações.`)}` : null;
  const linkTel = lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, '')}` : null;
  const acao = linkZap || linkTel;
  const nota = lead.rating ? lead.rating.toFixed(1).replace('.', ',') : null;
  const ilustrativo = !servicos.length;

  const vars = {
    '--f': tema.fundo,
    '--t': tema.texto,
    '--s': tema.suave,
    '--d': tema.destaque,
    '--td': tema.textoDestaque,
    '--c': tema.cartao,
  } as React.CSSProperties;

  const Botao = ({ grande = false }: { grande?: boolean }) =>
    acao ? (
      <a
        href={acao}
        target={linkZap ? '_blank' : undefined}
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center rounded-full bg-[var(--d)] font-bold text-[var(--td)] transition-opacity hover:opacity-90 ${
          grande ? 'min-h-[56px] px-8 text-[16px]' : 'min-h-[48px] px-6 text-[14.5px]'
        }`}
      >
        {linkZap ? tema.chamada : `Ligar: ${lead.phone}`}
      </a>
    ) : null;

  return (
    <div style={vars} className="min-h-screen bg-[var(--f)] text-[var(--t)]">
      {/* faixa da prévia */}
      <p className="bg-[var(--t)] px-4 py-2 text-center text-[12px] font-semibold text-[var(--f)]">
        Prévia de site feita por {empresa.nome} para {lead.name}
      </p>

      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-5 py-6 md:px-8">
        <span className="text-[18px] font-extrabold tracking-[-0.02em]">{lead.name}</span>
        {acao && (
          <a href={acao} target={linkZap ? '_blank' : undefined} rel="noopener noreferrer" className="hidden rounded-full border border-[var(--t)]/20 px-4 py-2 text-[13px] font-bold hover:border-[var(--t)] sm:inline-flex">
            {linkZap ? 'WhatsApp' : 'Ligar'}
          </a>
        )}
      </header>

      {/* abertura */}
      <section className="mx-auto max-w-[1080px] px-5 pb-16 pt-8 md:px-8 md:pb-24 md:pt-14">
        {lead.category && <p className="text-[14px] font-bold text-[var(--d)]">{lead.category}{lead.city ? ` em ${lead.city}` : ''}</p>}
        <h1 className="mt-3 max-w-[820px] text-balance text-[44px] font-extrabold leading-[1] tracking-[-0.04em] md:text-[72px]">{lead.name}</h1>
        <p className="mt-5 max-w-[560px] text-[18px] leading-relaxed text-[var(--s)] md:text-[20px]">{frase}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Botao grande />
          {nota && lead.reviews ? (
            <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold">
              <span className="flex text-[var(--d)]" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </span>
              {nota} · {lead.reviews} avaliações no Google
            </span>
          ) : null}
        </div>
      </section>

      {/* serviços */}
      <section className="mx-auto max-w-[1080px] px-5 py-14 md:px-8">
        <h2 className="text-[30px] font-extrabold tracking-[-0.03em] md:text-[40px]">O que oferecemos</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listaServicos.map((s) => (
            <li key={s} className="rounded-[20px] bg-[var(--c)] px-6 py-5 text-[16px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <span className="mb-3 block h-1.5 w-8 rounded-full bg-[var(--d)]" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* por que */}
      <section className="mx-auto max-w-[1080px] px-5 py-14 md:px-8">
        <div className="grid gap-8 rounded-[28px] bg-[var(--c)] p-8 md:grid-cols-[1fr_1.2fr] md:p-12">
          <div>
            <h2 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[38px]">Por que escolher {lead.name}</h2>
            {nota && lead.reviews ? (
              <p className="mt-6">
                <span className="block text-[56px] font-extrabold leading-none tracking-[-0.04em] text-[var(--d)]">{nota}</span>
                <span className="mt-1 block text-[14px] font-semibold text-[var(--s)]">de nota no Google, com {lead.reviews} avaliações de clientes</span>
              </p>
            ) : null}
          </div>
          <ul className="space-y-4 self-center">
            {porque.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[17px] font-semibold">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--d)]" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* onde e quando */}
      {(lead.address || horario.length > 0) && (
        <section className="mx-auto grid max-w-[1080px] gap-6 px-5 py-14 md:grid-cols-2 md:px-8">
          {lead.address && (
            <div className="rounded-[24px] bg-[var(--c)] p-7">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Onde estamos</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[var(--s)]">{lead.address}</p>
              {lead.mapsUrl && (
                <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-[44px] items-center rounded-full border border-[var(--t)]/20 px-5 text-[14px] font-bold hover:border-[var(--t)]">
                  Como chegar
                </a>
              )}
            </div>
          )}
          {horario.length > 0 && (
            <div className="rounded-[24px] bg-[var(--c)] p-7">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Horário</h2>
              <dl className="mt-3 space-y-1.5 text-[15px]">
                {horario.map((h) => (
                  <div key={h.dia} className="flex justify-between gap-4 border-b border-[var(--t)]/10 pb-1.5 last:border-0">
                    <dt className="font-semibold">{h.dia}</dt>
                    <dd className="text-[var(--s)]">{h.horas}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {/* fecho */}
      <section className="mx-auto max-w-[1080px] px-5 pb-20 pt-10 text-center md:px-8">
        <h2 className="mx-auto max-w-[640px] text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[44px]">
          Fale com {lead.name} agora
        </h2>
        <div className="mt-8 flex justify-center">
          <Botao grande />
        </div>
      </section>

      <footer className="border-t border-[var(--t)]/10 px-5 py-8 text-center text-[12.5px] text-[var(--s)]">
        <p>© {new Date().getFullYear()} {lead.name}</p>
        <p className="mt-2">
          Esta é uma prévia criada por {empresa.nome}
          {ilustrativo ? '. Os serviços e textos são ilustrativos e serão trocados pelos reais.' : '.'}
          {empresa.telefone ? ` Contato: ${empresa.telefone}.` : ''}
        </p>
      </footer>
    </div>
  );
}
