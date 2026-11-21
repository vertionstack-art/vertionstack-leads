import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import PainelPerfil from './painel-perfil';
import { lerFoto } from '@/lib/perfil';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { UserRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaPerfil() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const foto = await lerFoto(sessao.contaId, sessao.userId);

  return (
    <Casca
      tela="perfil"
      conversas={podeUsarConversa(sessao.email)}
      cor="lavanda"
      icone={<UserRound aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Meu perfil</>}
      subtitulo={<>{sessao.email}</>}
    >
        <PainelPerfil fotoInicial={foto} />
    </Casca>
  );
}
