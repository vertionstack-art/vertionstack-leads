import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { sessaoAtual } from '@/lib/conta';
import { nivelDaSessao } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import { caminhoCentral } from '@/lib/caminho-central';
import PainelCentral from './painel-central';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vertion Leads', robots: { index: false, follow: false } };

export default async function PaginaCentral() {
  const segredo = caminhoCentral();
  const sessao = await sessaoAtual();
  // para quem não é o administrador a página simplesmente não existe
  if (!segredo || !sessao?.admin) notFound();
  // a senha sozinha não abre: precisa do código do Google Authenticator
  if ((await nivelDaSessao()) !== 'aal2') redirect(`/${segredo}/2fa`);

  const cabecalhos = await headers();
  await registrarAcesso(cabecalhos, 'acessos', 'ok', sessao.email, 15);

  return <PainelCentral meuIp={ipDaRequisicao(cabecalhos)} />;
}
