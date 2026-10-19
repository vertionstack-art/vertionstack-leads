'use client';

import {
  Crown, Kanban, LayoutGrid, LogOut, Map as IconeMapa, MessagesSquare, Plus, Radar, Upload, UserRound, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import Logo from './logo';

/**
 * O trilho preto da esquerda (computador) e a doca de baixo (celular), iguais
 * em todas as telas de dentro: a pessoa sempre sabe onde está e chega em
 * qualquer lugar com um clique. A tela atual fica marcada.
 *
 * O painel passa ações só dele (baixar CSV, atualizar) em `extras` e abre o
 * cadastro na hora; nas outras telas, "Cadastrar comércio" leva ao painel já
 * com o cadastro aberto (/?cadastrar=1).
 */

export type Tela = 'painel' | 'buscar' | 'conversas' | 'crm' | 'financeiro' | 'planos' | 'mapa' | 'importar' | 'perfil' | null;

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
  if (href) {
    return (
      <a href={href} className={classe} aria-current={ativo ? 'page' : undefined} title={rotulo}>
        {conteudo}
      </a>
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
  /** a conversa guiada do WhatsApp (por enquanto só a conta da Vertion) */
  conversas: boolean;
  /** no painel, abre o cadastro ali mesmo */
  aoCadastrar?: () => void;
  /** no painel, volta ao topo em vez de recarregar */
  aoPainel?: () => void;
  extras?: ItemExtra[];
}) {
  const i = 'h-5 w-5';
  const doca = [
    { tela: 'painel' as const, rotulo: 'Painel', href: '/', Icone: LayoutGrid },
    { tela: 'buscar' as const, rotulo: 'Buscar', href: '/buscar', Icone: Radar },
    ...(conversas ? [{ tela: 'conversas' as const, rotulo: 'Conversas', href: '/conversas', Icone: MessagesSquare }] : []),
    { tela: 'crm' as const, rotulo: 'CRM', href: '/crm', Icone: Kanban },
    ...(conversas ? [] : [{ tela: 'financeiro' as const, rotulo: 'Financeiro', href: '/financeiro', Icone: Wallet }]),
    { tela: 'perfil' as const, rotulo: 'Perfil', href: '/perfil', Icone: UserRound },
  ];

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
          {conversas && (
            <Item rotulo="Conversas (WhatsApp)" ativo={ativo === 'conversas'} href="/conversas">
              <MessagesSquare className={i} strokeWidth={1.8} />
            </Item>
          )}
          <Item rotulo="CRM" ativo={ativo === 'crm'} href="/crm">
            <Kanban className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Financeiro" ativo={ativo === 'financeiro'} href="/financeiro">
            <Wallet className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Cadastrar comércio" href={aoCadastrar ? undefined : '/?cadastrar=1'} onClick={aoCadastrar}>
            <Plus className={i} strokeWidth={1.8} />
          </Item>
          <Item rotulo="Planos" ativo={ativo === 'planos'} href="/planos">
            <Crown className={i} strokeWidth={1.8} />
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
            <a key={tela} href={href} className={classe} aria-current={atual ? 'page' : undefined}>
              <Icone className="h-5 w-5" strokeWidth={1.8} />
              {rotulo}
            </a>
          );
        })}
      </nav>
    </>
  );
}
