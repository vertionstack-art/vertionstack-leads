import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { abrirPagamento, pagamentoLigado, pixLigado, situacaoDaCobranca, type Forma, type PlanoPago } from '@/lib/pagamento';
import { estourou } from '@/lib/limite';
import { origemDoSite } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** abre a tela de pagamento da Stripe para o plano escolhido */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!pagamentoLigado) return NextResponse.json({ ok: false, erro: 'O pagamento ainda não foi ligado.' }, { status: 503 });

  const corpo = (await req.json().catch(() => ({}))) as { plano?: string; forma?: string };
  const plano = corpo.plano as PlanoPago;
  const forma = corpo.forma as Forma;
  if (plano !== 'semanal' && plano !== 'basic' && plano !== 'pro') return NextResponse.json({ ok: false, erro: 'Plano inválido.' }, { status: 400 });
  // o de 7 dias é para quem ainda não assina: quem já tem Basic ou Pro em dia não troca dias caros por baratos
  if (plano === 'semanal' && (s.sessao.plano === 'basic' || s.sessao.plano === 'pro')) {
    return NextResponse.json({ ok: false, erro: `Você já tem o plano ${s.sessao.plano === 'pro' ? 'Pro' : 'Basic'} em dia.` }, { status: 409 });
  }
  if (forma !== 'cartao' && forma !== 'pix') return NextResponse.json({ ok: false, erro: 'Forma de pagamento inválida.' }, { status: 400 });
  if (forma === 'pix' && !pixLigado) return NextResponse.json({ ok: false, erro: 'O Pix ainda não está disponível. Use o cartão.' }, { status: 400 });

  if (await estourou('checkout:' + s.sessao.contaId, 10, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas tentativas de pagamento. Espere um pouco.' }, { status: 429 });
  }

  // quem já assina no cartão troca de plano ou cancela pelo portal, para não ficar com duas assinaturas
  if (forma === 'cartao' && plano !== 'semanal' && (await situacaoDaCobranca(s.sessao.contaId)).assinaturaAtiva) {
    return NextResponse.json(
      { ok: false, erro: 'Você já tem uma assinatura no cartão. Use "Gerenciar assinatura" para trocar de plano ou cancelar.' },
      { status: 409 },
    );
  }

  try {
    const url = await abrirPagamento({ contaId: s.sessao.contaId, email: s.sessao.email, plano, forma, site: origemDoSite(req) });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ ok: false, erro: 'Não consegui abrir o pagamento agora. Tente de novo.' }, { status: 500 });
  }
}
