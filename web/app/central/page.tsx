import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { sessaoAtual } from '@/lib/conta';
import { aparelhoDoAdmin, codigoDoAdminRecente } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import { caminhoCentral } from '@/lib/caminho-central';
import { estourou } from '@/lib/limite';
import PainelCentral from './painel-central';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vertion Leads', robots: { index: false, follow: false } };

export default async function PaginaCentral() {
  const segredo = caminhoCentral();
  const sessao = await sessaoAtual();
  // para quem não é o administrador (ou está num aparelho não liberado) a página não existe
  if (!segredo || !sessao?.admin || !(await aparelhoDoAdmin(sessao.userId))) notFound();
  if (await estourou('central:' + sessao.userId, 120, 10 * 60)) notFound();
  // a senha sozinha não abre: precisa do código do Google Authenticator, e recente
  if (!(await codigoDoAdminRecente())) redirect(`/${segredo}/2fa`);

  const cabecalhos = await headers();
  await registrarAcesso(cabecalhos, 'central', 'ok', sessao.email, 15);

  return <PainelCentral meuIp={ipDaRequisicao(cabecalhos)} />;
}
