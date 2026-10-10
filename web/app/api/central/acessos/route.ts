import { NextResponse } from 'next/server';
import { exigirAdmin, origemConfere, recusarOrigem } from '@/lib/auth';
import { bloquear, desbloquear, resumoPorIp, ultimosAcessos } from '@/lib/acessos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const a = await exigirAdmin();
  if (a.erro) return a.erro;

  const url = new URL(req.url);
  const ip = url.searchParams.get('ip') || undefined;

  return NextResponse.json({
    ok: true,
    ips: await resumoPorIp(300),
    historico: await ultimosAcessos(ip ? 200 : 60, ip),
    filtrandoIp: ip || null,
  });
}

export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const a = await exigirAdmin();
  if (a.erro) return a.erro;
  const quem = a.sessao;

  const corpo = (await req.json().catch(() => ({}))) as {
    ip?: string;
    motivo?: string;
    acao?: 'bloquear' | 'liberar';
  };

  if (!corpo.ip) {
    return NextResponse.json({ ok: false, erro: 'Faltou o endereco.' }, { status: 400 });
  }

  if (corpo.acao === 'liberar') {
    await desbloquear(corpo.ip);
  } else {
    await bloquear(String(corpo.ip).slice(0, 64), (corpo.motivo || '').slice(0, 200), quem.email);
  }

  return NextResponse.json({ ok: true, ips: await resumoPorIp(300) });
}
