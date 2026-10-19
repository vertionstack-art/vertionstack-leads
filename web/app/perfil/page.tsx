import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import PainelPerfil from './painel-perfil';
import { lerFoto } from '@/lib/perfil';
import Indique from './indique';
import { BONUS_BUSCAS, BONUS_LEADS, resumoDaIndicacao } from '@/lib/indicacao';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { UserRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaPerfil() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const foto = await lerFoto(sessao.contaId, sessao.userId);
  const indicacao = await resumoDaIndicacao(sessao.contaId);

  return (
    <Casca
      tela="perfil"
      conversas={podeUsarConversa(sessao.email)}
      cor="lavanda"
      icone={<UserRound aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Meu perfil</>}
      subtitulo={<>{sessao.email}</>}
    >
        <Indique resumo={indicacao} bonusLeads={BONUS_LEADS} bonusBuscas={BONUS_BUSCAS} />
        <PainelPerfil fotoInicial={foto} />
        <p className="mt-10 text-center text-[12px] font-medium text-zinc-500">
          <a href="/termos" className="hover:text-tinta hover:underline">Termos de uso</a>
          <span className="mx-2" aria-hidden>·</span>
          <a href="/privacidade" className="hover:text-tinta hover:underline">Política de privacidade</a>
        </p>
    </Casca>
  );
}
