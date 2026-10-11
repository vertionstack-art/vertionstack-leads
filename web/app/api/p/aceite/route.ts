import { NextResponse } from 'next/server';
import { atualizarLead, buscarLead } from '@/lib/db';
import { lerCaminho } from '@/lib/token-proposta';
import { contaLegada } from '@/lib/conta';
import { origemConfere, recusarOrigem } from '@/lib/auth';
import { ipDaRequisicao, registrarAcesso } from '@/lib/acessos';
import { estourou } from '@/lib/limite';
import { registrarEvento } from '@/lib/eventos';
import { avisarAceite } from '@/lib/avisos';
import { montarProposta, normalizarMarcacoes } from '@/lib/proposta';
import type { Formalizacao, Porte } from '@/lib/catalogo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O cliente aceitou a proposta pelo link público. Não precisa de login: quem
 * prova o direito é o token do link (lib/token-proposta), o mesmo que abre a
 * proposta. Fica guardado na proposta quem aceitou, quando, de onde e por
 * qual valor; o lead vira "fechado" e quem mandou recebe um e-mail.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const ip = ipDaRequisicao(req);
  if (await estourou('aceite:' + ip, 10, 60 * 60)) {
    return NextResponse.json({ ok: false, erro: 'Tentativas demais. Espere alguns minutos.' }, { status: 429 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { segmento?: string; token?: string; nome?: string };
  const nome = String(corpo.nome || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (nome.length < 3) return NextResponse.json({ ok: false, erro: 'Escreva o seu nome completo.' }, { status: 400 });

  const alvo = lerCaminho(String(corpo.segmento || ''), String(corpo.token || ''));
  if (!alvo) return NextResponse.json({ ok: false, erro: 'Link inválido.' }, { status: 404 });
  const conta = 'conta' in alvo ? alvo.conta : await contaLegada();
  if (!conta) return NextResponse.json({ ok: false, erro: 'Link inválido.' }, { status: 404 });
  const lead = await buscarLead(conta, alvo.id);
  if (!lead || !lead.proposta || typeof lead.proposta !== 'object') {
    return NextResponse.json({ ok: false, erro: 'Proposta não encontrada.' }, { status: 404 });
  }

  const cfg = lead.proposta as Record<string, unknown> & { aceite?: { em: string } };
  // aceitar duas vezes não muda nada: devolve o primeiro aceite
  if (cfg.aceite?.em) return NextResponse.json({ ok: true, em: cfg.aceite.em });

  const valores = montarProposta({
    marcacoes: normalizarMarcacoes(cfg.marcacoes),
    porte: (cfg.porte as Porte) || 'micro',
    formalizacao: (cfg.formalizacao as Formalizacao) || 'desconhecido',
    desconto: cfg.desconto as number | undefined,
    ignorarTeto: cfg.ignorarTeto as boolean | undefined,
  });
  const em = new Date().toISOString();
  const nova = {
    ...cfg,
    fechado: true,
    fechadoEm: typeof cfg.fechadoEm === 'string' && cfg.fechado ? cfg.fechadoEm : em,
    aceite: {
      nome,
      em,
      ip,
      navegador: (req.headers.get('user-agent') || '').slice(0, 200),
      entrada: valores.entrada,
      mensalidade: valores.mensalidade,
    },
  };
  await atualizarLead(conta, lead.id, { proposta: nova, status: 'fechado' }, null);
  await registrarEvento(conta, lead.id, 'proposta_fechada', `Proposta aceita online por ${nome}`, null);
  await registrarAcesso(req, `proposta-aceite:${lead.id}`, 'ok');
  await avisarAceite(conta, lead.name, nome, valores.entrada, valores.mensalidade);
  return NextResponse.json({ ok: true, em });
}
