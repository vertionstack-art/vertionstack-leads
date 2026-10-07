import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { LIMITES } from '@/lib/planos';
import {
  apagarFunil,
  candidatos,
  criarFunil,
  moverCard,
  quadro,
  renomearFunil,
  salvarEtapas,
  textoCurto,
  tirarDoFunil,
  uuidValido,
  validarEtapas,
} from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const erro = (msg: string, status = 400) => NextResponse.json({ ok: false, erro: msg }, { status });

/** o quadro de um funil; com ?candidatos=1, os leads que dá para adicionar nele */
export async function GET(req: Request) {
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const url = new URL(req.url);
  const funil = url.searchParams.get('funil');
  if (url.searchParams.get('candidatos')) {
    if (!uuidValido(funil)) return erro('Funil inválido.');
    const lista = await candidatos(s.sessao.contaId, funil, textoCurto(url.searchParams.get('q'), 60));
    return NextResponse.json({ ok: true, lista });
  }
  return NextResponse.json({ ok: true, ...(await quadro(s.sessao.contaId, uuidValido(funil) ? funil : null)) });
}

/**
 * Toda alteração do CRM passa por aqui, separada por "acao". Cada uma confere
 * de novo que o funil, a etapa e os leads são da conta de quem está logado.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem, plano, userId } = s.sessao;
  if (await estourou('crm:' + userId, 900, 60 * 60)) return erro('Muitas alterações seguidas. Espere um minuto.', 429);

  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (c.acao) {
    case 'mover': {
      const leads = Array.isArray(c.leads) ? c.leads.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 300)) : [];
      if (!leads.length || leads.length > 200) return erro('Escolha de 1 a 200 leads.');
      if (!uuidValido(c.etapa)) return erro('Etapa inválida.');
      const ordem = typeof c.ordem === 'number' && Number.isFinite(c.ordem) ? c.ordem : null;
      const n = await moverCard(contaId, leads, c.etapa, ordem, quem);
      if (n < 0) return erro('Etapa não encontrada.', 404);
      return NextResponse.json({ ok: true, movidos: n });
    }
    case 'tirar': {
      if (typeof c.lead !== 'string') return erro('Lead inválido.');
      const ok = await tirarDoFunil(contaId, c.lead.slice(0, 300));
      return ok ? NextResponse.json({ ok }) : erro('Lead não encontrado.', 404);
    }
    case 'criarFunil': {
      const nome = textoCurto(c.nome, 40);
      if (!nome) return erro('Dê um nome ao funil.');
      const r = await criarFunil(contaId, nome, LIMITES[plano].funis);
      return 'erro' in r ? erro(r.erro, 403) : NextResponse.json({ ok: true, id: r.id });
    }
    case 'renomearFunil': {
      const nome = textoCurto(c.nome, 40);
      if (!uuidValido(c.funil) || !nome) return erro('Dê um nome ao funil.');
      const ok = await renomearFunil(contaId, c.funil, nome);
      return ok ? NextResponse.json({ ok }) : erro('Funil não encontrado.', 404);
    }
    case 'apagarFunil': {
      if (!uuidValido(c.funil)) return erro('Funil inválido.');
      const r = await apagarFunil(contaId, c.funil);
      return 'erro' in r ? erro(r.erro) : NextResponse.json({ ok: true });
    }
    case 'salvarEtapas': {
      if (!uuidValido(c.funil)) return erro('Funil inválido.');
      const lista = validarEtapas(c.etapas);
      if (typeof lista === 'string') return erro(lista);
      const r = await salvarEtapas(contaId, c.funil, lista);
      return 'erro' in r ? erro(r.erro, 404) : NextResponse.json({ ok: true });
    }
    default:
      return erro('Ação desconhecida.');
  }
}
