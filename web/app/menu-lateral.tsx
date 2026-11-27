'use client';

import {
  FileText, Kanban, LayoutGrid, LogOut, Map as IconeMapa, Menu as IconeMais, MessagesSquare, Plus, Radar, Upload, UserRound, Wallet, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from './logo';

/**
 * O trilho preto da esquerda (computador) e a doca de baixo (celular), iguais
 * em todas as telas de dentro: a pessoa sempre sabe onde está e chega em
 * qualquer lugar com um clique. A tela atual fica marcada.
 *
 * O painel passa ações só dele (baixar CSV, atualizar) em `extras` e abre o
 * cadastro na hora; nas outras telas, "Cadastrar lead" leva ao painel já
 * com o cadastro aberto (/?cadastrar=1).
 */

export type Tela = 'painel' | 'buscar' | 'conversas' | 'crm' | 'propostas' | 'financeiro' | 'mapa' | 'importar' | 'perfil' | null;

export interface ItemExtra {
  rotulo: string;
  icone: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

function Item({
  rotulo, ativo, onClick, href, children,
}: {
  rotulo: string; ativo?: boolean; onClick?: () => void; href?: string; children: React.ReactNode;
}) {
  const classe = `relative flex h-12 w-full shrink-0 items-center rounded-2xl transition-colors duration-200 ${
    ativo ? 'bg-white text-tinta' : 'text-white/60 hover:bg-white/10 hover:text-white'
  }`;
  const conteudo = (
    <>
      {ativo && <span aria-hidden className="absolute -left-4 h-6 w-[3px] rounded-r-full bg-roxo-400" />}
      <span className="flex h-12 w-12 shrink-0 items-center justify-center">{children}</span>
      <span className="-translate-x-1 whitespace-nowrap pr-3 text-[13.5px] font-bold opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/trilho:translate-x-0 group-hover/trilho:opacity-100 group-focus-within/trilho:translate-x-0 group-focus-within/trilho:opacity-100 motion-reduce:transition-none">
        {rotulo}
      </span>
    </>
  );
  // arquivo para baixar (CSV) é link comum; tela da ferramenta troca sem recarregar a página inteira
  if (href?.startsWith('/api/')) {
    return (
      <a href={href} className={classe} title={rotulo}>
        {conteudo}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={classe} aria-current={ativo ? 'page' : undefined} title={rotulo}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classe} title={rotulo}>
      {conteudo}
    </button>
  );
}

async function sair() {
  await fetch('/api/auth', { method: 'DELETE' });
  location.href = '/login';
}

export default function MenuLateral({
  ativo,
  conversas,
  aoCadastrar,
  aoPainel,
  extras = [],
}: {
  ativo: Tela;
  /**
   * a conversa guiada do WhatsApp (por enquanto só a conta da Vertion).
   * 'lembrar' é a tela de carregando, que ainda não sabe quem é: usa o que
   * a última tela completa deixou guardado, para o item não piscar.
   */
  conversas: boolean | 'lembrar';
  /** no painel, abre o cadastro ali mesmo */
  aoCadastrar?: () => void;
  /** no painel, volta ao topo em vez de recarregar */
  aoPainel?: () => void;
  extras?: ItemExtra[];
}) {
  const [verConversas, setVerConversas] = useState(conversas === true);
  useEffect(() => {
    try {
      if (conversas === 'lembrar') setVerConversas(localStorage.getItem('vl_conversas') === '1');
      else if (conversas) localStorage.setItem('vl_conversas', '1');
      else localStorage.removeItem('vl_conversas');
    } catch {
      // sem armazenamento no navegador: o item só aparece nas telas completas
    }
  }, [conversas]);
  const i = 'h-5 w-5';
  const doca = [
    { tela: 'painel' as const, rotulo: 'Painel', href: '/', Icone: LayoutGrid },
    { tela: 'buscar' as const, rotulo: 'Buscar', href: '/buscar', Icone: Radar },
    ...(verConversas ? [{ tela: 'conversas' as const, rotulo: 'Comercial', href: '/conversas', Icone: MessagesSquare }] : []),
    { tela: 'crm' as const, rotulo: 'CRM', href: '/crm', Icone: Kanban },
    ...(verConversas ? [] : [{ tela: 'financeiro' as const, rotulo: 'Financeiro', href: '/financeiro', Icone: Wallet }]),
  ];
  /*
   * No celular a doca só cabe cinco botões; o resto (propostas, financeiro,
   * cadastrar, mapa, importar, perfil, sair) mora na gaveta do "Mais".
   */
  const [maisAberto, setMaisAberto] = useState(false);
  useEffect(() => {
    if (!maisAberto) return;
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && setMaisAberto(false);
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [maisAberto]);
  const gaveta: { tela: Tela; rotulo: string; href?: string; onClick?: () => void; Icone: typeof Wallet }[] = [
    { tela: 'propostas', rotulo: 'Propostas', href: '/propostas', Icone: FileText },
    ...(verConversas || !doca.some((d) => d.tela === 'financeiro') ? [{ tela: 'financeiro' as const, rotulo: 'Financeiro', href: '/financeiro', Icone: Wallet }] : []),
    { tela: null, rotulo: 'Cadastrar lead', href: aoCadastrar ? undefined : '/?cadastrar=1', onClick: aoCadastrar, Icone: Plus },
    { tela: 'mapa', rotulo: 'Mapa dos leads', href: '/mapa', Icone: IconeMapa },
    { tela: 'importar', rotulo: 'Importar planilha', href: '/importar', Icone: Upload },
    { tela: 'perfil', rotulo: 'Meu perfil', href: '/perfil', Icone: UserRound },
  ];
  const maisAtivo = gaveta.some((g) => g.tela && g.tela === ativo);

  return (
    <>
      {/* ------------------------------------------- trilho preto (computador) */}
      <nav
        aria-label="Menu"
        className="group/trilho fixed inset-y-3 left-3 z-40 hidden w-[80px] flex-col overflow-hidden rounded-[26px] bg-tinta px-4 py-5 transition-[width,box-shadow] duration-200 ease-out hover:w-[232px] hover:shadow-[0_18px_50px_rgba(11,11,15,0.28)] focus-within:w-[232px] motion-reduce:transition-none md:flex"
      >
        <Link href="/" className="mb-7 flex items-center" aria-label="Vertion Leads, painel">
          <Logo tamanho={48} emQuadro />
          <span className="ml-3 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.01em] text-white opacity-0 transition-opacity duration-200 group-hover/trilho:opacity-100 group-focus-within/trilho:opacity-100">
            Vertion Leads
          </span>
        </Link>
        <div className="flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden">
          <Item rotulo="Painel" ativo={ativo === 'painel'} href={aoPainel ? undefined : '/'} onClick={aoPainel}>
            <LayoutGrid className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Buscar leads" ativo={ativo === 'buscar'} href="/buscar">
            <Radar className={i} strokeWidth={1.8} />
          </Item>
          {verConversas && (
            <Item rotulo="Comercial" ativo={ativo === 'conversas'} href="/conversas">
              <MessagesSquare className={i} strokeWidth={1.8} />
            </Item>
          )}
          <Item rotulo="CRM" ativo={ativo === 'crm'} href="/crm">
            <Kanban className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Propostas" ativo={ativo === 'propostas'} href="/propostas">
            <FileText className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Financeiro" ativo={ativo === 'financeiro'} href="/financeiro">
            <Wallet className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Cadastrar lead" href={aoCadastrar ? undefined : '/?cadastrar=1'} onClick={aoCadastrar}>
            <Plus className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Mapa dos leads" ativo={ativo === 'mapa'} href="/mapa">
            <IconeMapa className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Importar planilha" ativo={ativo === 'importar'} href="/importar">
            <Upload className={i} strokeWidth={1.8} />
          </Item>
          {extras.map((x) => (
            <Item key={x.rotulo} rotulo={x.rotulo} href={x.href} onClick={x.onClick}>
              {x.icone}
            </Item>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1.5 pt-3">
          <Item rotulo="Meu perfil" ativo={ativo === 'perfil'} href="/perfil">
            <UserRound className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Sair" onClick={sair}>
            <LogOut className={i} strokeWidth={1.8} />
          </Item>
        </div>
      </nav>

      {/* ------------------------------------------- doca preta (celular) */}
      <nav
        aria-label="Menu"
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[22px] bg-tinta px-1.5 py-1.5 shadow-[0_10px_30px_rgba(11,11,15,0.25)] md:hidden"
      >
        {doca.map(({ tela, rotulo, href, Icone }) => {
          const atual = ativo === tela;
          const classe = `flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10.5px] font-bold ${
            atual ? 'bg-white text-tinta' : 'text-white/70 active:text-white'
          }`;
          return tela === 'painel' && aoPainel ? (
            <button key={tela} type="button" onClick={aoPainel} className={classe}>
              <Icone className="h-5 w-5" strokeWidth={1.8} />
              {rotulo}
            </button>
          ) : (
            <Link key={tela} href={href} className={classe} aria-current={atual ? 'page' : undefined}>
              <Icone className="h-5 w-5" strokeWidth={1.8} />
              {rotulo}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          aria-expanded={maisAberto}
          aria-haspopup="dialog"
          className={`flex min-h-[52px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10.5px] font-bold ${
            maisAtivo ? 'bg-white text-tinta' : 'text-white/70 active:text-white'
          }`}
        >
          <IconeMais className="h-5 w-5" strokeWidth={1.8} />
          Mais
        </button>
      </nav>

      {/* ------------------------------------------- gaveta do "Mais" (celular) */}
      {maisAberto && (
        <div className="fixed inset-0 z-[2000] md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button type="button" aria-label="Fechar" onClick={() => setMaisAberto(false)} className="absolute inset-0 bg-tinta/40" />
          <div className="absolute inset-x-3 bottom-3 rounded-[24px] bg-tinta p-3 pb-2 shadow-[0_18px_50px_rgba(11,11,15,0.35)]">
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <span className="text-[13px] font-extrabold text-white">Mais</span>
              <button type="button" onClick={() => setMaisAberto(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10">
                <X className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[...gaveta, ...extras.map((x) => ({ tela: null as Tela, rotulo: x.rotulo, href: x.href, onClick: x.onClick, Icone: null, icone: x.icone }))].map((g) => {
                const atual = Boolean(g.tela) && g.tela === ativo;
                const classe = `flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center text-[11.5px] font-bold leading-tight ${
                  atual ? 'bg-white text-tinta' : 'bg-white/[0.06] text-white/85 active:bg-white/15'
                }`;
                const icone = 'Icone' in g && g.Icone ? <g.Icone className="h-5 w-5" strokeWidth={1.8} /> : (g as { icone?: React.ReactNode }).icone;
                return g.href ? (
                  <Link key={g.rotulo} href={g.href} onClick={() => setMaisAberto(false)} className={classe} aria-current={atual ? 'page' : undefined}>
                    {icone}
                    {g.rotulo}
                  </Link>
                ) : (
                  <button key={g.rotulo} type="button" onClick={() => { setMaisAberto(false); g.onClick?.(); }} className={classe}>
                    {icone}
                    {g.rotulo}
                  </button>
                );
              })}
              <button type="button" onClick={() => { setMaisAberto(false); sair(); }} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] px-1 text-[11.5px] font-bold text-white/85 active:bg-white/15">
                <LogOut className="h-5 w-5" strokeWidth={1.8} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
