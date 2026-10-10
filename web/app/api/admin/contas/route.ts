import { NextResponse } from 'next/server';
import { type Plano } from '@/lib/conta';
import { exigirAdmin, origemConfere, recusarOrigem } from '@/lib/auth';
import { usoDoMes } from '@/lib/google-places';
import { juntarNaConta, listarAssinantes, migrarDoNeon, mudarConta, receitaDaFerramenta } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PLANOS: Plano[] = ['gratis', 'semanal', 'basic', 'pro', 'cortesia'];

export async function GET() {
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  const [contas, receita, google] = await Promise.all([listarAssinantes(), receitaDaFerramenta(), usoDoMes()]);
  return NextResponse.json({ ok: true, contas, receita, google, minhaConta: a.sessao.contaId });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  const s = a.sessao;

  const corpo = (await req.json().catch(() => ({}))) as {
    acao?: 'plano' | 'bloquear' | 'liberar' | 'juntar' | 'migrar';
    contaId?: string;
    plano?: string;
    email?: string;
  };

  try {
    switch (corpo.acao) {
      case 'plano':
        if (!corpo.contaId || !PLANOS.includes(corpo.plano as Plano)) break;
        await mudarConta(corpo.contaId, { plano: corpo.plano as Plano });
        return NextResponse.json({ ok: true, contas: await listarAssinantes() });
      case 'bloquear':
      case 'liberar':
        if (!corpo.contaId) break;
        if (corpo.contaId === s.contaId) {
          return NextResponse.json({ ok: false, erro: 'Você não pode suspender a sua própria conta.' }, { status: 400 });
        }
        await mudarConta(corpo.contaId, { bloqueada: corpo.acao === 'bloquear' });
        return NextResponse.json({ ok: true, contas: await listarAssinantes() });
      case 'juntar': {
        if (!corpo.email) break;
        const r = await juntarNaConta(s.contaId, corpo.email);
        if (!r.ok) return NextResponse.json({ ok: false, erro: r.erro }, { status: 400 });
        return NextResponse.json({ ok: true, contas: await listarAssinantes() });
      }
      case 'migrar': {
        const r = await migrarDoNeon(s.contaId);
        return NextResponse.json({ ok: true, migracao: r, contas: await listarAssinantes() });
      }
    }
  } catch (err) {
    console.error('[admin contas]', err);
    return NextResponse.json({ ok: false, erro: String((err as Error).message).slice(0, 300) }, { status: 500 });
  }
  return NextResponse.json({ ok: false, erro: 'Pedido incompleto.' }, { status: 400 });
}
