import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cotaDaConta, sessaoAtual } from '@/lib/conta';
import { estaBloqueado, ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import Painel from './painel';
import { buscaLigada } from '@/lib/google-places';
import { lerFoto } from '@/lib/perfil';
import { avisoDeVencimento } from '@/lib/pagamento';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sessao = await sessaoAtual();
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

  const cota = await cotaDaConta(sessao.contaId, sessao.plano);
  const foto = await lerFoto(sessao.contaId, sessao.userId);
  const vencimento = sessao.plano === 'cortesia' ? null : await avisoDeVencimento(sessao.contaId);

  return (
    <Painel
      usuario={sessao.nome}
      foto={foto}
      buscaGoogle={buscaLigada()}
      vencimento={vencimento}
      plano={sessao.plano}
      bloqueada={sessao.bloqueada}
      cota={{ usados: cota.usados, limite: cota.limite, ilimitado: cota.ilimitado, renovaEm: cota.renovaEm, teste: cota.teste, testeNegado: cota.testeNegado }}
    />
  );
}
