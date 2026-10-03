/**
 * Cliente do Supabase Auth no servidor, lendo e gravando a sessão nos cookies.
 *
 * Só serve para o LOGIN (quem é a pessoa). Os dados ficam fora daqui: o
 * cliente usa a chave pública, que não lê tabela nenhuma por causa do RLS.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function supabaseServidor() {
  const jar = await cookies();
  return createServerClient(URL_SUPABASE, CHAVE_PUBLICA, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) jar.set(name, value, options);
        } catch {
          // chamado de dentro de um server component, que não grava cookie;
          // o proxy renova a sessão na próxima requisição
        }
      },
    },
  });
}
