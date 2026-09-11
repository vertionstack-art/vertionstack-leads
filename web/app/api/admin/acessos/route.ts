import { NextResponse } from 'next/server';
import { ehDono, dono } from '@/lib/auth';
import { bloquear, desbloquear, resumoPorIp, ultimosAcessos } from '@/lib/acessos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await ehDono())) {
    return NextResponse.json({ ok: false, erro: 'So o dono do painel ve isto.' }, { status: 403 });
  }

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
  const quem = await ehDono();
  if (!quem) {
    return NextResponse.json({ ok: false, erro: 'So o dono do painel pode bloquear.' }, { status: 403 });
  }

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
    await bloquear(corpo.ip, (corpo.motivo || '').slice(0, 200), dono);
  }

  return NextResponse.json({ ok: true, ips: await resumoPorIp(300) });
}
