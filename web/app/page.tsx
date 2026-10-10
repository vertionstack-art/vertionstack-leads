import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cotaDaConta, sessaoAtual } from '@/lib/conta';
import { estaBloqueado, ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import Painel from './painel';
import Inicio from './inicio';
import { buscaLigada } from '@/lib/google-places';
import { lerFoto } from '@/lib/perfil';
import { avisoDeVencimento } from '@/lib/pagamento';
import { primeirosPassos } from '@/lib/passos';
import { quantosLembretesHoje } from '@/lib/eventos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vertion Leads: ache comércios sem site e venda o site para eles',
  description:
    'Busca comércios no Google da sua cidade e entrega só quem precisa de site, com temperatura, motivo para abordar, WhatsApp, proposta e CRM. Teste grátis com 30 leads, sem cartão.',
};

export default async function Home() {
  const sessao = await sessaoAtual();
  // quem não está logado vê a página de venda; quem está, o painel
  if (!sessao) return <Inicio />;

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
  // uma por vez: consultas em paralelo prendem conexões no pooler do Supabase
  const passos = await primeirosPassos(sessao.contaId);
  const lembretesHoje = await quantosLembretesHoje(sessao.contaId);

  return (
    <Painel
      usuario={sessao.nome}
      foto={foto}
      buscaGoogle={buscaLigada()}
      vencimento={vencimento}
      passos={passos}
      planoEscolhido={sessao.plano === 'gratis' ? sessao.planoEscolhido : null}
      lembretesHoje={lembretesHoje}
      plano={sessao.plano}
      bloqueada={sessao.bloqueada}
      cota={{ usados: cota.usados, limite: cota.limite, ilimitado: cota.ilimitado, renovaEm: cota.renovaEm, teste: cota.teste, testeNegado: cota.testeNegado, bonus: cota.bonus }}
    />
  );
}
