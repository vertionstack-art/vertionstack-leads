import { notFound } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { aparelhoDoAdmin } from '@/lib/auth';
import { caminhoCentral } from '@/lib/caminho-central';
import DoisFatores from './dois-fatores';

export const dynamic = 'force-dynamic';

export default async function PaginaDoisFatores() {
  const segredo = caminhoCentral();
  const sessao = await sessaoAtual();
  // para quem não é o administrador, ou num aparelho não liberado, esta página não existe
  if (!segredo || !sessao?.admin || !(await aparelhoDoAdmin(sessao.userId))) notFound();
  return <DoisFatores destino={`/${segredo}`} />;
}
