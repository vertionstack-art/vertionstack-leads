import { redirect } from 'next/navigation';
import { usuarioAtual, exigeSenha, dono } from '@/lib/auth';
import { temBanco } from '@/lib/db';
import Painel from './painel';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  return (
    <Painel semBanco={!temBanco} semSenha={!exigeSenha} usuario={usuario} ehDono={usuario === dono} />
  );
}
