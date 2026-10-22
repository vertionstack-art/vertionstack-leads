import { NextResponse } from 'next/server';
import { buscarLead } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { estourou } from '@/lib/limite';
import { podeUsarConversa } from '@/lib/conversa-contexto';
import { mensagensDaConversa, passosFeitos } from '@/lib/conversa';
import { entregarAoRobo, estadoDoRobo, ligarRoboNaConversa, resolverEspera, responderSePrecisar } from '@/lib/robo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Ctx = { params: Promise<{ id: string }> };

/**
 * O robô de vendas numa conversa:
 * { acao: 'ligar', ligado }      liga ou desliga nesta conversa
 * { acao: 'entregar', texto }    você preparou o que ele esperava (link, valor, resposta): ele manda ao cliente
 * { acao: 'resolver' }           você mesmo resolveu: ele para de esperar
 * { acao: 'responder' }          responde agora a última mensagem do cliente
 */
export async function POST(req: Request, ctx: Ctx) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  if (!podeUsarConversa(s.sessao.email)) return NextResponse.json({ ok: false, erro: 'Não encontrado.' }, { status: 404 });
  if (await estourou('robo:' + s.sessao.userId, 30, 60)) {
    return NextResponse.json({ ok: false, erro: 'Muitas ações seguidas. Espere um minuto.' }, { status: 429 });
  }
  const { contaId, nome } = s.sessao;
  const { id } = await ctx.params;
  const lead = decodeURIComponent(id).slice(0, 300);
  if (!(await buscarLead(contaId, lead))) return NextResponse.json({ ok: false, erro: 'Lead não encontrado.' }, { status: 404 });

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; ligado?: boolean; texto?: string };
  let erro: string | null = null;

  if (corpo.acao === 'ligar') {
    await ligarRoboNaConversa(contaId, lead, corpo.ligado !== false);
  } else if (corpo.acao === 'resolver') {
    await resolverEspera(contaId, lead);
  } else if (corpo.acao === 'entregar') {
    const texto = String(corpo.texto || '').trim().slice(0, 1500);
    if (!texto) return NextResponse.json({ ok: false, erro: 'Escreva ou cole o que o robô deve mandar.' }, { status: 400 });
    const r = await entregarAoRobo(contaId, lead, texto, nome);
    if (r.feito === 'erro') erro = r.motivo;
    else if (r.feito !== 'respondeu') erro = 'O robô não mandou: ele achou um trecho que não pode usar. Veja o aviso e mande você.';
  } else if (corpo.acao === 'responder') {
    const r = await responderSePrecisar(contaId, lead, undefined, true);
    if (r.feito === 'erro') erro = r.motivo;
    else if (r.feito === 'pulou') {
      erro = {
        'robô desligado': 'Ligue o robô na conta e nesta conversa primeiro.',
        'falta configurar': 'Falta a chave do Gemini (ou o WhatsApp) na Vercel.',
        'última mensagem não é do cliente': 'A última mensagem não é do cliente: não há o que responder.',
        'já respondido': 'O robô já respondeu a última mensagem do cliente.',
        ocupado: 'O robô está respondendo agora. Espere alguns segundos.',
      }[r.motivo] || 'O robô não respondeu agora.';
    }
  } else {
    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  }

  return NextResponse.json({
    ok: !erro,
    erro,
    robo: await estadoDoRobo(contaId, lead),
    mensagens: await mensagensDaConversa(contaId, lead),
    passos: await passosFeitos(contaId, lead),
  }, { status: erro ? 422 : 200 });
}
