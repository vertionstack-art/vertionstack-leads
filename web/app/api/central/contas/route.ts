import { NextResponse } from 'next/server';
import { type Plano } from '@/lib/conta';
import { exigirAdmin, origemConfere, recusarOrigem } from '@/lib/auth';
import { usoDoMes } from '@/lib/google-places';
import { juntarNaConta, mudarConta, receitaDaFerramenta } from '@/lib/admin';
import { darDias, liberarTeste, pagamentos, pessoas, porDia } from '@/lib/central';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PLANOS: Plano[] = ['gratis', 'semanal', 'basic', 'pro', 'cortesia'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tudo(minhaConta: string) {
  // uma de cada vez: disparadas juntas pela mesma conexão do pooler do Supabase,
  // algumas ficavam presas esperando; em sequência o total fica em ~1 segundo
  const lista = await pessoas();
  const receita = await receitaDaFerramenta();
  const google = await usoDoMes();
  const historico = await pagamentos();
  const dias = await porDia();
  return { ok: true, pessoas: lista, receita, google, pagamentos: historico, dias, minhaConta };
}

export async function GET() {
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  return NextResponse.json(await tudo(a.sessao.contaId));
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  const s = a.sessao;

  const corpo = (await req.json().catch(() => ({}))) as {
    acao?: 'plano' | 'bloquear' | 'liberar' | 'juntar' | 'dias' | 'liberar_teste';
    contaId?: string;
    plano?: string;
    email?: string;
    dias?: number;
  };
  const conta = typeof corpo.contaId === 'string' && UUID.test(corpo.contaId) ? corpo.contaId : null;

  try {
    switch (corpo.acao) {
      case 'plano':
        if (!conta || !PLANOS.includes(corpo.plano as Plano)) break;
        await mudarConta(conta, { plano: corpo.plano as Plano });
        return NextResponse.json(await tudo(s.contaId));
      case 'dias': {
        const dias = Math.floor(Number(corpo.dias));
        if (!conta || !(dias >= 1 && dias <= 366)) break;
        await darDias(conta, dias);
        return NextResponse.json(await tudo(s.contaId));
      }
      case 'liberar_teste':
        if (!conta) break;
        await liberarTeste(conta);
        return NextResponse.json(await tudo(s.contaId));
      case 'bloquear':
      case 'liberar':
        if (!conta) break;
        if (conta === s.contaId) {
          return NextResponse.json({ ok: false, erro: 'Você não pode suspender a sua própria conta.' }, { status: 400 });
        }
        await mudarConta(conta, { bloqueada: corpo.acao === 'bloquear' });
        return NextResponse.json(await tudo(s.contaId));
      case 'juntar': {
        if (!corpo.email) break;
        const r = await juntarNaConta(s.contaId, corpo.email);
        if (!r.ok) return NextResponse.json({ ok: false, erro: r.erro }, { status: 400 });
        return NextResponse.json(await tudo(s.contaId));
      }
    }
  } catch (err) {
    console.error('[central]', err);
    return NextResponse.json({ ok: false, erro: 'Não consegui fazer isso agora.' }, { status: 500 });
  }
  return NextResponse.json({ ok: false, erro: 'Pedido incompleto.' }, { status: 400 });
}
