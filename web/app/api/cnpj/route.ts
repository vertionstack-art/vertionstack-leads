/**
 * Consulta um CNPJ na Receita e devolve o que a proposta precisa saber.
 *
 * Fica no servidor e não no navegador por dois motivos: a BrasilAPI recusa
 * requisição sem User-Agent próprio, e chamar de dentro do painel exporia
 * a origem do pedido a quem inspecionasse a aba de rede. Aqui também dá
 * para exigir sessão, para a rota não virar proxy grátis de consulta de
 * CNPJ para qualquer um que descubra o endereço.
 */

import { NextResponse } from 'next/server';
import { estaLogado } from '@/lib/auth';
import { consultarCnpj } from '@/lib/cnpj';

export async function POST(req: Request) {
  if (!(await estaLogado())) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  let corpo: { cnpj?: string };
  try {
    corpo = (await req.json()) as { cnpj?: string };
  } catch {
    return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400 });
  }

  const resultado = await consultarCnpj(corpo.cnpj || '');
  if (!resultado.ok) {
    return NextResponse.json({ ok: false, erro: resultado.erro }, { status: 422 });
  }

  return NextResponse.json({ ok: true, dados: resultado.dados });
}
