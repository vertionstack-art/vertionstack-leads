import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { estaBloqueado, ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import Painel from './painel';
import { lerFoto } from '@/lib/perfil';
import { quantosLembretesHoje } from '@/lib/eventos';
import { podeUsarConversa } from '@/lib/conversa-contexto';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vertion Leads',
};

export default async function Home() {
  const sessao = await sessaoAtual();
  // desde 21/11/2026 não há página de venda: sem login, vai para a tela de entrar
  if (!sessao) redirect('/login');

  /*
   * Registrar só o login deixava de fora justamente o caso comum: quem já
   * tem sessão aberta entra no painel todo dia sem passar pela tela de
   * senha, e nunca aparecia na lista de acessos. A janela de 15 minutos
   * evita uma linha por recarregamento.
   */
  const cabecalhos = await headers();
  if (await estaBloqueado(ipDaRequisicao(cabecalhos))) redirect('/login');
  await registrarAcesso(cabecalhos, 'painel', 'ok', sessao.email, 15);

  const foto = await lerFoto(sessao.contaId, sessao.userId);
  const lembretesHoje = await quantosLembretesHoje(sessao.contaId);

  return <Painel conversas={podeUsarConversa(sessao.email)} usuario={sessao.nome} foto={foto} lembretesHoje={lembretesHoje} />;
}
