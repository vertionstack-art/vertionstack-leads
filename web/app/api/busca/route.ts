import { NextResponse } from 'next/server';
import { exigirSessao, origemConfere, recusarOrigem } from '@/lib/auth';
import { conferirTeste, cotaDaConta, cotaParaJson, devolverCota, reservarCota } from '@/lib/conta';
import { idsNovos, normalizarLead, salvarLeads } from '@/lib/db';
import {
  anotarBusca, buscaLigada, buscarPagina, chamadasDeHoje, chaveDaPergunta, contarChamada, ErroGoogle, memoriaDaBusca, somarLeads,
  tetoDiario, tetoMensal, usoDoMes,
} from '@/lib/google-places';
import { estourou } from '@/lib/limite';
import { aplicarAvaliacao, avaliarLead, type MotivoDescarte } from '@/lib/enriquecer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const erro = (msg: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, erro: msg, ...extra }, { status });

function texto(v: unknown, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Uma página de busca no Google: até 20 comércios de "nicho em local". A tela
 * chama de novo com o token da próxima página, e de pergunta em pergunta
 * (bairro por bairro) até juntar a quantidade pedida ou a pessoa clicar em
 * parar. Uma chamada por pedido mantém cada resposta rápida e deixa o botão
 * de parar funcionar de verdade.
 *
 * Só os comércios sem site próprio são guardados e contam na cota: quem já
 * tem site não é lead, e a pessoa não paga cota por ele.
 */
export async function POST(req: Request) {
  if (!origemConfere(req)) return recusarOrigem();
  const s = await exigirSessao();
  if (s.erro) return s.erro;
  const { contaId, nome: quem, plano, userId } = s.sessao;

  if (!buscaLigada()) return erro('A busca pelo Google ainda não foi ligada.', 503);
  if (await estourou('busca:' + userId, 240, 60 * 60)) return erro('Muitas buscas seguidas. Espere alguns minutos.', 429);

  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nicho = texto(c.nicho, 60);
  const local = texto(c.local, 90);
  const pagina = typeof c.pagina === 'string' && /^[A-Za-z0-9_\-=.]{1,2000}$/.test(c.pagina) ? c.pagina : null;
  const quero = Math.max(1, Math.min(200, Math.floor(Number(c.quero) || 20)));
  // padrão ligado: lead sem WhatsApp quase nunca vira conversa
  const soComWhatsapp = c.soComWhatsapp !== false;
  if (nicho.length < 2 || local.length < 2) return erro('Diga o nicho e a cidade.', 400);

  // nada de gastar com o Google se a pessoa não pode guardar lead nenhum
  let cota = await cotaDaConta(contaId, plano);
  if (cota.teste) {
    const negado = await conferirTeste(contaId);
    if (negado) {
      cota = await cotaDaConta(contaId, plano);
      return erro(`O teste grátis já foi usado em outra conta ${negado}. Assine um plano para buscar leads.`, 402, { cota: cotaParaJson(cota), fim: true });
    }
  }
  if (!cota.ilimitado && cota.restantes <= 0) {
    const msg = cota.teste
      ? `Seu teste grátis de ${cota.limite} leads acabou. Assine um plano para continuar buscando.`
      : cota.guardados >= cota.tetoGuardados
        ? `Sua conta chegou ao limite de ${cota.tetoGuardados} leads guardados do plano.`
        : `Você usou os ${cota.limite} leads novos desta semana. A cota renova na segunda.`;
    return erro(msg, 402, { cota: cotaParaJson(cota), fim: true });
  }
  if ((await usoDoMes()).chamadas >= tetoMensal()) {
    return erro('A busca pelo Google chegou ao limite deste mês. Volta a funcionar no dia 1º.', 503, { fim: true });
  }
  if ((await chamadasDeHoje()) >= tetoDiario()) {
    return erro('A busca pelo Google chegou ao limite de hoje. Volta a funcionar amanhã.', 503, { fim: true });
  }

  /*
   * Não pagar por repetido: pergunta que esta conta já levou até a última
   * página não chama o Google de novo; pergunta pela metade continua da
   * página onde parou, em vez de recomeçar pelos mesmos resultados.
   */
  const pergunta = `${nicho} em ${local}`;
  const chave = chaveDaPergunta(pergunta);
  let token = pagina;
  let retomada = false;
  if (!pagina) {
    const memoria = await memoriaDaBusca(contaId, chave);
    if (memoria?.esgotada) {
      return NextResponse.json({
        ok: true, jaFeita: true, comercios: 0, comSite: 0, jaTinha: 0, novos: 0, comWhatsappLink: 0, proxima: null,
        descartados: { empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0 },
        cota: cotaParaJson(cota), fim: false,
      });
    }
    if (memoria?.proxima) {
      token = memoria.proxima;
      retomada = true;
    }
  }

  let resultado;
  try {
    try {
      resultado = await buscarPagina(pergunta, token);
    } catch (e) {
      // token guardado que o Google não aceita mais: recomeça do começo
      if (!retomada || !(e instanceof ErroGoogle) || e.status !== 400) throw e;
      retomada = false;
      resultado = await buscarPagina(pergunta, null);
    }
  } catch (e) {
    if (e instanceof ErroGoogle) return erro(e.message, e.status === 429 ? 429 : 502);
    console.error('[busca]', e);
    return erro('A busca no Google falhou. Tente de novo.', 502);
  }
  await anotarBusca(contaId, chave, resultado.proxima, !pagina && !retomada);
  // conta a chamada já, antes de qualquer coisa que possa falhar: o Google cobrou
  await contarChamada(contaId, resultado.comercios.length, 0);

  const cidade = local.split(',').slice(-1)[0].trim() || local;
  const todos = resultado.comercios
    .map((g) =>
      normalizarLead(
        {
          name: g.nome,
          placeKey: 'g:' + g.id,
          category: g.tipo || nicho,
          searchTerm: nicho,
          city: cidade,
          phone: g.telefone,
          address: g.endereco,
          website: g.site,
          rating: g.nota,
          reviews: g.avaliacoes,
          mapsUrl: g.mapsUrl,
          lat: g.lat,
          lng: g.lng,
        },
        quem,
        'google',
      ),
    )
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const leads = todos.filter((l) => l.isLead);

  try {
    const novosIds = new Set(await idsNovos(contaId, leads.map((l) => l.id)));
    const existentes = leads.filter((l) => !novosIds.has(l.id));

    // o filtro de precisão roda só nos que ainda não estão no painel (lib/enriquecer)
    const descartados: Record<MotivoDescarte, number> = { empresa_grande: 0, site_proprio: 0, sem_contato: 0, sem_whatsapp: 0 };
    const candidatos = leads.filter((l) => novosIds.has(l.id));
    const avaliacoes = await Promise.all(candidatos.map((l) => avaliarLead(l, soComWhatsapp)));
    const aprovados = candidatos.flatMap((l, i) => {
      const a = avaliacoes[i];
      if (a.descarte) {
        descartados[a.descarte]++;
        return [];
      }
      return [aplicarAvaliacao(l, a)];
    });

    const limite = cota.ilimitado ? quero : Math.min(quero, cota.restantes);
    const novos = aprovados.slice(0, limite);
    const concedidos = await reservarCota(contaId, novos.length, plano);
    const r = await salvarLeads(contaId, [...existentes, ...novos], concedidos);
    if (!cota.ilimitado) await devolverCota(contaId, concedidos - r.novos, plano);
    await somarLeads(contaId, r.novos);
    cota = await cotaDaConta(contaId, plano);

    return NextResponse.json({
      ok: true,
      comercios: resultado.comercios.length,
      comSite: todos.length - leads.length,
      retomada,
      jaTinha: existentes.length,
      descartados,
      comWhatsappLink: novos.filter((l) => l.whatsappFonte === 'link').length,
      novos: r.novos,
      proxima: resultado.proxima,
      cota: cotaParaJson(cota),
      fim: !cota.ilimitado && cota.restantes <= 0,
    });
  } catch (e) {
    console.error('[busca salvar]', e);
    return erro('Falha ao guardar os leads. Tente de novo.', 500);
  }
}
