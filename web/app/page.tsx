import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { usuarioAtual, exigeSenha } from '@/lib/auth';
import { temBanco } from '@/lib/db';
import { estaBloqueado, ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import Painel from './painel';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');

  /*
   * Registrar só o login deixava de fora justamente o caso comum: quem já
   * tem sessão aberta entra no painel todo dia sem passar pela tela de
   * senha, e nunca aparecia na lista de acessos. A janela de 15 minutos
   * evita uma linha por recarregamento.
   */
  const cabecalhos = await headers();
  if (await estaBloqueado(ipDaRequisicao(cabecalhos))) redirect('/login');
  await registrarAcesso(cabecalhos, 'painel', 'ok', usuario, 15);
  return <Painel semBanco={!temBanco} semSenha={!exigeSenha} usuario={usuario} />;
}
