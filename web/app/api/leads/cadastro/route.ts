import { NextResponse } from 'next/server';
import { buscarLead, idsNovos, normalizarLead, salvarLeads } from '@/lib/db';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { cotaDaConta, cotaParaJson, devolverCota, reservarCota } from '@/lib/conta';
import { estourou } from '@/lib/limite';
import { db } from '@/lib/sql';
import { definirLembrete, registrarEvento } from '@/lib/eventos';
import { interessesValidos } from '@/lib/interesses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const texto = (v: unknown, max: number) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Cadastro de um lead à mão: um comércio ou uma pessoa que quer um projeto.
 * Além dos dados de contato, guarda o que ele quer (site, sistema,
 * automação...) e a ideia que contou, e, se veio uma data, marca a reunião
 * como lembrete. Gasta a mesma cota semanal da busca, como o cadastro antigo.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem, ilimitado, plano } = s.sessao;
  if (await estourou(`manual:${contaId}`, 60, 60)) {
    return NextResponse.json({ ok: false, erro: 'Cadastros demais em pouco tempo. Espere um minuto.' }, { status: 429 });
  }
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tipo = c.tipo === 'pessoa' ? 'pessoa' : 'comercio';
  const nome = texto(c.nome, 250);
  if (!nome) return NextResponse.json({ ok: false, erro: tipo === 'pessoa' ? 'Escreva o nome da pessoa.' : 'Escreva o nome do comércio.' }, { status: 400 });

  const telefone = texto(c.telefone, 40);
  const cidade = texto(c.cidade, 120);
  const lead = normalizarLead(
    {
      // sem place id do Maps: a chave vem do nome com a cidade (comércio) ou o telefone (pessoa)
      placeKey: `manual:${tipo === 'pessoa' ? 'pessoa:' : ''}${nome.toLowerCase()}|${(tipo === 'pessoa' ? telefone || cidade || '' : cidade || '').toLowerCase()}`,
      name: nome,
      category: tipo === 'pessoa' ? texto(c.categoria, 120) || 'Pessoa física' : texto(c.categoria, 120),
      phone: telefone,
      address: tipo === 'pessoa' ? null : texto(c.endereco, 300),
      city: cidade,
      website: texto(c.site, 900),
      instagram: texto(c.instagram, 300),
      email: texto(c.email, 254),
      mapsUrl: tipo === 'pessoa' ? null : texto(c.mapsUrl, 900),
      notes: texto(c.notas, 2000),
      searchTerm: 'cadastro manual',
      tipo,
    },
    quem,
    'manual',
  );
  if (!lead) return NextResponse.json({ ok: false, erro: 'Não consegui ler o cadastro.' }, { status: 400 });

  const novo = (await idsNovos(contaId, [lead.id])).length > 0;
  if (!novo) return NextResponse.json({ ok: false, erro: 'Esse lead já está cadastrado.' }, { status: 409 });
  const concedidos = await reservarCota(contaId, 1, plano);
  const r = await salvarLeads(contaId, [lead], concedidos);
  if (!ilimitado) await devolverCota(contaId, concedidos - r.novos, plano);
  if (!r.novos) {
    const cota = await cotaDaConta(contaId, plano);
    return NextResponse.json(
      { ok: false, erro: 'Seu plano chegou ao limite de leads desta semana. Veja os planos para cadastrar mais.', cota: cotaParaJson(cota) },
      { status: 402 },
    );
  }

  const interesse = interessesValidos(c.interesse);
  const ideia = texto(c.ideia, 3000);
  await db()`
    update leads set tipo = ${tipo}, interesse = ${interesse}, ideia = ${ideia}, updated_at = now()
    where conta_id = ${contaId} and id = ${lead.id}
  `;
  await registrarEvento(contaId, lead.id, 'nota', `Cadastrado à mão (${tipo === 'pessoa' ? 'pessoa' : 'comércio'})`, quem);

  // reunião marcada já no cadastro vira o lembrete do lead (aparece em "Para hoje" no CRM)
  const reuniao = c.reuniaoEm ? new Date(String(c.reuniaoEm)) : null;
  if (reuniao && !Number.isNaN(reuniao.getTime())) {
    await definirLembrete(contaId, lead.id, reuniao, `Reunião${texto(c.reuniaoTexto, 150) ? `: ${texto(c.reuniaoTexto, 150)}` : ''}`, quem);
  }

  return NextResponse.json({ ok: true, lead: await buscarLead(contaId, lead.id) });
}
