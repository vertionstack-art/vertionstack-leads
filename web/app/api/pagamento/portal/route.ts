import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { abrirPortal, pagamentoLigado } from '@/lib/pagamento';
import { origemDoSite } from '@/lib/porta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** abre a página da Stripe para trocar o cartão, ver faturas ou cancelar */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (await estourou('portal:' + s.sessao.userId, 20, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  if (!pagamentoLigado) return NextResponse.json({ ok: false, erro: 'O pagamento ainda não foi ligado.' }, { status: 503 });

  try {
    const url = await abrirPortal(s.sessao.contaId, origemDoSite(req));
    if (!url) return NextResponse.json({ ok: false, erro: 'Você ainda não tem nenhum pagamento registrado.' }, { status: 404 });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[portal]', err);
    return NextResponse.json({ ok: false, erro: 'Não consegui abrir agora. Tente de novo.' }, { status: 500 });
  }
}
