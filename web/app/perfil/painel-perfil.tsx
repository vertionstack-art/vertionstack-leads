'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, QrCode } from 'lucide-react';
import { NOME_DO_PLANO, reais, type Plano } from '@/lib/planos';
import FotoDePerfil from './foto';

interface Perfil {
  nome: string;
  empresaNome: string;
  empresaWhatsapp: string;
  empresaEmail: string;
  empresaSite: string;
  empresaCidade: string;
  empresaDocumento: string;
  metaMensal: number;
}

interface Dados {
  email: string;
  papel: 'dono' | 'membro';
  plano: Plano;
  pagoAte: string | null;
  perfil: Perfil;
  equipe: string[];
  pagamentos: { id: string; plano: 'basic' | 'pro'; forma: 'cartao' | 'pix'; valorCentavos: number; pagoEm: string; descricao: string | null }[];
  cobranca: { forma: 'cartao' | 'pix' | null; temPortal: boolean; assinaturaAtiva: boolean; cancelaEm: string | null; pagamentoFalhou: boolean };
}

const campo =
  'min-h-[44px] w-full rounded-full border border-zinc-200 bg-white px-4 text-[14px] font-medium outline-none transition-colors placeholder:text-zinc-500 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100 disabled:bg-zinc-50 disabled:text-zinc-500';
const rotulo = 'mb-1.5 block text-[13px] font-bold';

function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PainelPerfil({ fotoInicial }: { fotoInicial: string | null }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [p, setP] = useState<Perfil | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    fetch('/api/perfil', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDados(d);
          setP(d.perfil);
        } else setAviso({ tipo: 'erro', texto: d.erro || 'Não consegui carregar.' });
      })
      .catch(() => setAviso({ tipo: 'erro', texto: 'Sem conexão.' }));
  }, []);

  if (!dados || !p) {
    return (
      <div className="mt-10 space-y-4" aria-label="Carregando">
        <div className="h-40 animate-pulse rounded-[24px] bg-zinc-100" />
        <div className="h-64 animate-pulse rounded-[24px] bg-zinc-100" />
      </div>
    );
  }

  const dono = dados.papel === 'dono';
  const mudou = JSON.stringify(p) !== JSON.stringify(dados.perfil);
  const set = (k: keyof Perfil) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP((a) => (a ? { ...a, [k]: k === 'metaMensal' ? Number(e.target.value.replace(/\D/g, '')) || 0 : e.target.value } : a));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch('/api/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const d = await r.json();
      if (!d.ok) setAviso({ tipo: 'erro', texto: d.erro || 'Não consegui salvar.' });
      else {
        setDados((a) => (a ? { ...a, perfil: d.perfil } : a));
        setP(d.perfil);
        setAviso({ tipo: 'ok', texto: 'Perfil salvo. As próximas propostas já saem com estes dados.' });
      }
    } catch {
      setAviso({ tipo: 'erro', texto: 'Falha de rede.' });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      const r = await fetch('/api/perfil', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmacao }) });
      const d = await r.json();
      if (d.ok) window.location.assign('/login');
      else {
        setAviso({ tipo: 'erro', texto: d.erro || 'Não consegui excluir.' });
        setExcluindo(false);
      }
    } catch {
      setAviso({ tipo: 'erro', texto: 'Falha de rede.' });
      setExcluindo(false);
    }
  }

  const contato = [p.empresaWhatsapp, p.empresaEmail, p.empresaSite.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ');

  return (
    <form onSubmit={salvar} className="mt-8 space-y-6" noValidate>
      {/* ------------------------------------------------------- você */}
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Você</h2>
        <div className="mt-4">
          <FotoDePerfil inicial={(p.nome || dados.email).slice(0, 1)} fotoInicial={fotoInicial} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className={rotulo}>Como você aparece no painel</span>
            <input value={p.nome} onChange={set('nome')} maxLength={40} className={campo} />
            <span className="mt-1.5 block text-[12px] text-zinc-500">É o nome que aparece em &quot;com você&quot; e em quem coletou cada lead.</span>
          </label>
          <label className="block">
            <span className={rotulo}>E-mail de acesso</span>
            <input value={dados.email} disabled className={campo} />
            <span className="mt-1.5 block text-[12px] text-zinc-500">
              <Link href="/nova-senha" className="font-semibold text-roxo-700 underline underline-offset-2">Trocar senha</Link>
            </span>
          </label>
        </div>
      </section>

      {/* ---------------------------------------------- empresa + prévia */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-zinc-200 p-6">
          <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Sua empresa</h2>
          <p className="mt-1 text-[13px] text-zinc-600">
            Estes dados assinam as propostas que você manda aos seus clientes.
            {!dono && ' Só quem criou a conta pode mudar.'}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={rotulo}>Nome da empresa ou seu nome profissional</span>
              <input value={p.empresaNome} onChange={set('empresaNome')} disabled={!dono} maxLength={80} placeholder="Ex.: Studio Ana Web" className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>WhatsApp</span>
              <input value={p.empresaWhatsapp} onChange={set('empresaWhatsapp')} disabled={!dono} inputMode="tel" placeholder="(63) 99999-0000" className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>E-mail comercial</span>
              <input value={p.empresaEmail} onChange={set('empresaEmail')} disabled={!dono} type="email" placeholder="contato@suaempresa.com.br" className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Site ou portfólio</span>
              <input value={p.empresaSite} onChange={set('empresaSite')} disabled={!dono} placeholder="suaempresa.com.br" className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Cidade</span>
              <input value={p.empresaCidade} onChange={set('empresaCidade')} disabled={!dono} placeholder="Gurupi - TO" className={campo} />
            </label>
            <label className="block md:col-span-2">
              <span className={rotulo}>CNPJ ou CPF (opcional)</span>
              <input value={p.empresaDocumento} onChange={set('empresaDocumento')} disabled={!dono} inputMode="numeric" className={campo} />
            </label>
          </div>
        </div>

        {/* a prévia: como o cliente dele vê o topo e o rodapé da proposta */}
        <div className="flex flex-col rounded-[24px] bg-tinta p-6 text-white">
          <p className="text-[12px] font-bold text-white/60">Assim aparece para o seu cliente</p>
          <div className="mt-4 rounded-2xl bg-white p-5 text-tinta">
            <p className="text-[18px] font-extrabold tracking-[-0.01em]">{p.empresaNome || p.nome || 'Sua empresa'}</p>
            <p className="mt-0.5 text-[12px] text-zinc-500">Proposta comercial · Barbearia do Zé</p>
            <div className="my-4 h-px bg-zinc-200" />
            <p className="text-[12.5px] leading-relaxed text-zinc-600">
              Hoje quem procura vocês no Google e clica no site cai numa página que não abre…
            </p>
            <div className="my-4 h-px bg-zinc-200" />
            <p className="text-[13px] font-bold">{p.empresaNome || p.nome || 'Sua empresa'}</p>
            <p className="text-[12px] text-zinc-500">{contato || 'Seu WhatsApp · e-mail · site'}</p>
            {p.empresaCidade && <p className="text-[12px] text-zinc-500">{p.empresaCidade}</p>}
          </div>
          <p className="mt-auto pt-4 text-[12px] leading-relaxed text-white/60">
            As propostas que você já mandou também passam a mostrar estes dados quando o cliente abrir de novo.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- meta */}
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Meta de vendas do mês</h2>
        <p className="mt-1 text-[13px] text-zinc-600">Aparece no Financeiro, com quanto falta para bater. Deixe 0 para não usar meta.</p>
        <label className="mt-4 block max-w-[260px]">
          <span className="sr-only">Meta em reais</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-zinc-500">R$</span>
            <input
              value={p.metaMensal ? p.metaMensal.toLocaleString('pt-BR') : ''}
              onChange={set('metaMensal')}
              disabled={!dono}
              inputMode="numeric"
              placeholder="3.000"
              className={`${campo} pl-11 tabular-nums`}
            />
          </span>
        </label>
      </section>

      {/* ------------------------------------------------------- salvar */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-full bg-white/95 py-2 pl-5 pr-2 shadow-[0_8px_24px_rgba(11,11,15,0.12)] ring-1 ring-zinc-200">
        <p role={aviso ? 'status' : undefined} className={`text-[13px] font-semibold ${aviso?.tipo === 'erro' ? 'text-red-700' : 'text-zinc-600'}`}>
          {aviso ? aviso.texto : mudou ? 'Você tem alterações não salvas.' : 'Tudo salvo.'}
        </p>
        <button
          type="submit"
          disabled={salvando || !mudou}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-tinta px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-tinta-70 disabled:bg-zinc-300"
        >
          {!salvando && !mudou && <Check aria-hidden className="h-4 w-4" />}
          {salvando ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>

      {/* --------------------------------------------------- assinatura */}
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Assinatura</h2>
            <p className="mt-1 text-[13px] text-zinc-600">
              Plano <b className="text-tinta">{NOME_DO_PLANO[dados.plano]}</b>
              {dados.pagoAte && dados.plano !== 'gratis' && dados.plano !== 'cortesia' && <> · válido até {data(dados.pagoAte)}</>}
              {dados.cobranca.forma && <> · {dados.cobranca.forma === 'cartao' ? 'cartão, renova sozinho' : 'Pix, mês a mês'}</>}
              {dados.cobranca.cancelaEm && <> · cancelada, termina em {data(dados.cobranca.cancelaEm)}</>}
            </p>
          </div>
          <Link href="/planos" className="inline-flex min-h-[40px] items-center rounded-full bg-tinta px-5 text-[13px] font-bold text-white hover:bg-tinta-70">
            {dados.plano === 'gratis' ? 'Ver planos' : 'Planos e assinatura'}
          </Link>
        </div>

        <h3 className="mt-6 text-[13px] font-bold">Pagamentos</h3>
        {dados.pagamentos.length ? (
          <ul className="mt-2 divide-y divide-zinc-100">
            {dados.pagamentos.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                <span className="flex items-center gap-2.5">
                  {x.forma === 'cartao' ? <CreditCard aria-hidden className="h-4 w-4 text-zinc-500" /> : <QrCode aria-hidden className="h-4 w-4 text-zinc-500" />}
                  <span className="font-semibold">{NOME_DO_PLANO[x.plano]}</span>
                  <span className="text-zinc-500">{x.descricao}</span>
                </span>
                <span className="flex items-center gap-4 tabular-nums">
                  <span className="text-zinc-500">{data(x.pagoEm)}</span>
                  <b>{reais(x.valorCentavos)}</b>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-zinc-500">Nenhum pagamento ainda.</p>
        )}
      </section>

      {/* ---------------- equipe: só aparece na conta que tem mais gente (cortesia) */}
      {dados.equipe.length > 1 && (
      <section className="rounded-[24px] border border-zinc-200 p-6">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Quem usa esta conta</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {dados.equipe.map((n) => (
            <li key={n} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-[13px] font-semibold capitalize">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-roxo-200 text-[12px] font-extrabold uppercase text-tinta">{n.slice(0, 1)}</span>
              {n}
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* ------------------------------------------------- zona de perigo */}
      <section className="rounded-[24px] bg-zinc-50 p-6">
        <h2 className="text-[17px] font-extrabold">Excluir minha conta</h2>
        <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-zinc-600">
          Apaga seus leads, propostas e o seu acesso, e cancela a assinatura no cartão. Não dá para desfazer. Para confirmar,
          digite <b className="text-tinta">EXCLUIR</b>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label>
            <span className="sr-only">Digite EXCLUIR para confirmar</span>
            <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={`${campo} w-44`} />
          </label>
          <button
            type="button"
            onClick={excluir}
            disabled={excluindo || confirmacao.trim().toUpperCase() !== 'EXCLUIR'}
            className="min-h-[44px] rounded-full bg-red-700 px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-red-800 disabled:bg-zinc-300"
          >
            {excluindo ? 'Excluindo…' : 'Excluir conta'}
          </button>
        </div>
      </section>
    </form>
  );
}
