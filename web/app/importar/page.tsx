import { redirect } from 'next/navigation';
import { cotaDaConta, sessaoAtual } from '@/lib/conta';
import Importar from './importar';
import Casca from '@/app/casca';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { Upload } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaginaImportar() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/login');
  const cota = await cotaDaConta(sessao.contaId, sessao.plano);
  const vagas = cota.ilimitado ? null : Math.max(0, cota.tetoGuardados - cota.guardados);

  return (
    <Casca
      tela="importar"
      conversas={podeUsarConversa(sessao.email)}
      cor="ceu"
      icone={<Upload aria-hidden className="h-6 w-6" strokeWidth={2} />}
      titulo={<>Importar planilha</>}
      subtitulo={<>Traga a sua própria lista de comércios. Ela não gasta a cota de leads da semana.</>}
    >
        <Importar vagas={vagas} />
    </Casca>
  );
}
