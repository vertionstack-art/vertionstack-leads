import { redirect } from 'next/navigation';
import { estaLogado, exigeSenha } from '@/lib/auth';
import { temBanco } from '@/lib/db';
import Painel from './painel';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await estaLogado())) redirect('/login');
  return <Painel semBanco={!temBanco} semSenha={!exigeSenha} />;
}
