import { notFound } from 'next/navigation';
import { sessaoAtual } from '@/lib/conta';
import { caminhoCentral } from '@/lib/caminho-central';
import DoisFatores from './dois-fatores';

export const dynamic = 'force-dynamic';

export default async function PaginaDoisFatores() {
  const segredo = caminhoCentral();
  const sessao = await sessaoAtual();
  // para quem não é o administrador, esta página não existe
  if (!segredo || !sessao?.admin) notFound();
  return <DoisFatores destino={`/${segredo}`} />;
}
